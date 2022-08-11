/* Magic Mirror
 * Node Helper: MMM-TuyaThermometer
 *
 * By bugsounet ©2022
 * MIT Licensed.
 */

var NodeHelper = require("node_helper")
var qs = require("qs")
var crypto = require("crypto")
var axios = require("axios")

logTY = (...args) => { /* do nothing ! */ }

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
    this.Thermometer= {
      battery: null,
      temp: null,
      humidity: null,
      tendency: null
    }
    this.tempHistory = {
      data: [],
      average: null,
      lastAverage: null
    }
  },

  socketNotificationReceived: function (noti, payload) {
    switch (noti) {
      case "INIT":
        console.log("[TUYATH] MMM-TuyaThermostat Version:", require('./package.json').version)
        this.initialize(payload)
      break
    }
  },

  initialize: function (config) {
    this.config = config
    if (this.config.debug) logTY = (...args) => { console.log("[TUYATH]", ...args) }
    console.log("[TUYATH] Starting Tuya Thermostat module...")
    logTY("Config:", this.config)
    this.configAPI = {
      /* openapi host */
      host: 'https://openapi.tuya'+this.config.zone+'.com',
      /* fetch from openapi platform */
      accessKey: this.config.accessKey,
      /* fetch from openapi platform */
      secretKey: this.config.secretKey,
      /* Interface example device_ID */
      deviceId: this.config.deviceId,
      /* extra auto generate token */
      token: null
    }
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
    const data = await this.getDeviceInfo(this.configAPI.deviceId)
    if (!data.length) return console.error("[TUYATH] Error:", data.error)
    data.forEach(value => {
      if (value.code == "va_temperature") this.Thermometer.temp = value.value/10
      if (value.code == "va_humidity") this.Thermometer.humidity = value.value
      if (value.code == "battery_percentage") this.Thermometer.battery = value.value
    })
    this.Thermometer.tendency= this.averageTemp(this.Thermometer.temp)
    logTY("Fetch success !", this.Thermometer)
    this.sendSocketNotification("DATA", this.Thermometer)
    
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
    logTY("Token:", this.configAPI.token)
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

  getDeviceInfo: async function (deviceId) {
    const query = {};
    const method = 'GET';
    const url = `/v1.0/iot-03/devices/status?device_ids=${deviceId}`;
    const reqHeaders = await this.getRequestSign(url, method, {}, query);
  
    const { data } = await this.httpClient.request({
      method,
      data: {},
      params: {},
      headers: reqHeaders,
      url: reqHeaders.path,
    });

    if (!data || !data.success) {
      console.error(`[TUYATH] request api failed: ${data.msg}`)
      error = {error: data.msg}
      return error
    }
    logTY("Data:", data.result[0].status)
    return data.result[0].status
  },

  /** Calcul moyenne temp **/
  averageTemp: function(temp) {
    if (!temp) return
    let average = 0
    /** do Array of last 10 Temp **/
    if (this.tempHistory.data.length >= 10) this.tempHistory.data.splice(0,1)
    this.tempHistory.data.push(temp)

    /** do the average **/
    this.tempHistory.data.forEach(value => {
      average += value
    })
    average = (average/this.tempHistory.data.length).toFixed(1)
    this.tempHistory.lastAverage = this.tempHistory.average ? this.tempHistory.average: average
    this.tempHistory.average= average
    logTY("tempHistory:", this.tempHistory)
    if (this.tempHistory.average > this.tempHistory.lastAverage) return 1
    if (this.tempHistory.average < this.tempHistory.lastAverage) return 2
    return 0
  }
});
