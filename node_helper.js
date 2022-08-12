/* Magic Mirror
 * Node Helper: MMM-TuyaThermometer
 *
 * By bugsounet ©2022
 * MIT Licensed.
 */

"use strict"

var NodeHelper = require("node_helper")
var qs = require("qs")
var crypto = require("crypto")
var axios = require("axios")

var logTY = (...args) => { /* do nothing ! */ }

module.exports = NodeHelper.create({
  start: function () {
    this.configAPI = {
      host: null,
      accessKey: null,
      secretKey: null,
      deviceId: null,
      token: null
    }
    this.httpClient = null
    this.Thermometers= {}
    this.tempHistory = {}
  },

  socketNotificationReceived: function (noti, payload) {
    switch (noti) {
      case "INIT":
        console.log("[TUYATH] MMM-TuyaThermometer Version:", require('./package.json').version)
        this.initialize(payload)
      break
    }
  },

  initialize: function (config) {
    let zone = [ "us", "eu", "in", "cn" ]
    this.config = config
    if (this.config.debug) logTY = (...args) => { console.log("[TUYATH]", ...args) }
    console.log("[TUYATH] Starting Tuya Thermometer module...")
    logTY("Config:", this.config)
    if (!this.config.zone) return console.error("[TUYATH] Missing zone !")
    if (zone.indexOf(this.config.zone) == -1) return console.error("[TUYATH] Unknow zone !")
    if (!this.config.devices || !this.config.devices.length) return console.error("[TUYATH] Missing devices list !")

    this.configAPI = {
      /* openapi host */
      host: 'https://openapi.tuya'+this.config.zone+'.com',
      /* fetch from openapi platform */
      accessKey: this.config.accessKey,
      /* fetch from openapi platform */
      secretKey: this.config.secretKey,
      /* Interface example device_ID */
      deviceIds: [],
      /* extra auto generate token */
      token: null
    }

    if (!this.configAPI.accessKey) return console.error("[TUYATH] Missing accessKey !")
    if (!this.configAPI.secretKey) return console.error("[TUYATH] Missing secretKey !")

    this.config.devices.forEach(device => {
      if (device.deviceId) this.configAPI.deviceIds.push(device.deviceId)
    })

    if (!this.configAPI.deviceIds.length) return console.error("[TUYATH] Missing devices list !")

    this.httpClient = axios.create({
      baseURL: this.configAPI.host,
      timeout: 5 * 1e3,
    })
    this.mainProcess()

    setInterval(()=> {
      logTY("Updating data...")
      this.mainProcess()
    }, this.config.updateInterval*1000*60)
  },

  mainProcess: async function() {
    await this.getToken()
    const data = await this.getDeviceInfo(this.configAPI.deviceIds.toString())
    if (!data.length) return console.error("[TUYATH] Error:", data.error)
    data.forEach(device => {
      if (device.id && device.status.length) {
        let Thermometer = {
            temp: null,
            humidity: null,
            battery: null,
            tendency: null
        }
        device.status.forEach(value => {
          if (value.code == "va_temperature") Thermometer.temp = value.value/10
          if (value.code == "va_humidity") Thermometer.humidity = value.value
          if (value.code == "battery_percentage") Thermometer.battery = value.value
        })
        this.Thermometers[device.id] = Thermometer
        this.Thermometers[device.id].tendency = this.averageTemp(this.Thermometers[device.id].temp, device.id)
      }
    })
    logTY("Fetch success !", this.Thermometers)
    this.sendSocketNotification("DATA", this.Thermometers)
    
  },

  getToken: async function() {
    const method = 'GET'
    const timestamp = Date.now().toString()
    const signUrl = '/v1.0/token?grant_type=1'
    const contentHash = crypto.createHash('sha256').update('').digest('hex')
    const stringToSign = [method, contentHash, '', signUrl].join('\n')
    const signStr = this.configAPI.accessKey + timestamp + stringToSign
  
    const headers = {
      t: timestamp,
      sign_method: 'HMAC-SHA256',
      client_id: this.configAPI.accessKey,
      sign: await this.encryptStr(signStr, this.configAPI.secretKey),
    }
    logTY("Headers:", headers)
    const { data: login } = await this.httpClient.get('/v1.0/token?grant_type=1', { headers })
    if (!login || !login.success) {
      return console.error(`[TUYATH] fetch failed: ${login.msg}`)
    }
    this.configAPI.token = login.result.access_token
    logTY("configAPI:", this.configAPI)
  },

  encryptStr: async function (str, secret) {
    return crypto.createHmac('sha256', secret).update(str, 'utf8').digest('hex').toUpperCase()
  },

  getRequestSign: async function ( path, method, headers = {}, query = {}, body = {}) {
    const t = Date.now().toString()
    const [uri, pathQuery] = path.split('?')
    const queryMerged = Object.assign(query, qs.parse(pathQuery))
    const sortedQuery= {}
    Object.keys(queryMerged)
      .sort()
      .forEach((i) => (sortedQuery[i] = query[i]))
  
    const querystring = decodeURIComponent(qs.stringify(sortedQuery))
    const url = querystring ? `${uri}?${querystring}` : uri
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex')
    const stringToSign = [method, contentHash, '', url].join('\n')
    const signStr = this.configAPI.accessKey + this.configAPI.token + t + stringToSign
    return {
      t,
      path: url,
      client_id: this.configAPI.accessKey,
      sign: await this.encryptStr(signStr, this.configAPI.secretKey),
      sign_method: 'HMAC-SHA256',
      access_token: this.configAPI.token,
    }
  },

  getDeviceInfo: async function (deviceIds) {
    const query = {}
    const method = 'GET'
    const url = `/v1.0/iot-03/devices/status?device_ids=${deviceIds}`
    const reqHeaders = await this.getRequestSign(url, method, {}, query)
  
    const { data } = await this.httpClient.request({
      method,
      data: {},
      params: {},
      headers: reqHeaders,
      url: reqHeaders.path,
    })

    if (!data || !data.success) {
      console.error(`[TUYATH] request api failed: ${data.msg}`)
      let error = {error: data.msg}
      return error
    }
    logTY("Data: ", data.result)
    return data.result
  },

  /** Calcul moyenne temp **/
  averageTemp: function(temp,device) {
    if (!temp || !device) return
    let average = 0
    if (!this.tempHistory[device]) this.tempHistory[device] = []
    if (!this.tempHistory[device].data) this.tempHistory[device].data = []
    /** do Array of last 10 Temp **/
    if (this.tempHistory[device].data.length >= 10) this.tempHistory[device].data.splice(0,1)
    this.tempHistory[device].data.push(temp)

    /** do the average **/
    this.tempHistory[device].data.forEach(value => {
      average += value
    })
    average = (average/this.tempHistory[device].data.length).toFixed(1)
    this.tempHistory[device].lastAverage = this.tempHistory[device].average ? this.tempHistory[device].average: average
    this.tempHistory[device].average= average
    logTY("tempHistory for " + device + ":", this.tempHistory[device])
    if (this.tempHistory[device].average > this.tempHistory[device].lastAverage) return 1
    if (this.tempHistory[device].average < this.tempHistory[device].lastAverage) return 2
    return 0
  }
});
