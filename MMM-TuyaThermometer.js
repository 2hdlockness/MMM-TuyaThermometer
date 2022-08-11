/* global Module */

/* Magic Mirror
 * Module: MMM-TuyaThermometer
 *
 * By bugsounet ©2022
 * MIT Licensed.
 */
logTY = (...args) => { /* do nothing */ }

Module.register("MMM-TuyaThermometer", {
  defaults: {
    debug: true,
    accessKey: null,
    secretKey: null,
    deviceId: null,
    zone: "eu",
    name: "Thermometer name",
    updateInterval: 15,
    display: {
      fixed: true,
      name: true,
      battery: true,
      humidity: true,
      tendency: true
    }
  },
  requiresVersion: "2.18.0",

  start: function() {
    this.Thermometer = {
      battery: 0,
      temp: "--.-",
      humidity: "--",
      tendency: 0
    }
  },

  getDom: function() {
    var wrapper = document.createElement("div")
    wrapper.id = "TUYA_THERMO"
    if (this.config.display.fixed) wrapper.classList.add("fixed")

    var temp = document.createElement("div")
    temp.id = "TUYA_THERMO_TEMP"
      var zone1 = document.createElement("div")
      zone1.id = "TUYA_THERMO_ZONE1"

    temp.appendChild(zone1)

    var zone3 = document.createElement("div")
      zone3.id = "TUYA_THERMO_ZONE3"

      var name = document.createElement("div")
      name.id = "TUYA_THERMO_NAME"
      if (this.config.display.name) name.textContent = this.config.name
      zone3.appendChild(name)

      var tempValue = document.createElement("div")
      tempValue.id = "TUYA_THERMO_TEMP_VALUE"
      tempValue.textContent = this.Thermometer.temp + "°"

      zone3.appendChild(tempValue)

      var empty = document.createElement("div")
      empty.id = "TUYA_THERMO_EMPTY"
      zone3.appendChild(empty)

    temp.appendChild(zone3)

    var zone2 = document.createElement("div")
    zone2.id = "TUYA_THERMO_ZONE2"

      var battery = document.createElement("div")
      battery.id = "TUYA_THERMO_BATTERY"
      var batteryIcon = document.createElement("div")
      batteryIcon.id = "TUYA_THERMO_BATTERY_ICON"
      battery.appendChild(batteryIcon)
      var batteryValue = document.createElement("div")
      batteryValue.id = "TUYA_THERMO_BATTERY_VALUE"
      battery.appendChild(batteryValue)
      if (!this.config.display.battery) {
        batteryValue.className = "hidden"
        batteryIcon.className = "hidden"
      } else {
        batteryIcon.className = this.Thermometer.battery > 95 ? "fa fa-battery-full" :
                                this.Thermometer.battery >= 70 ? "fa fa-battery-three-quarters" :
                                this.Thermometer.battery >= 45 ? "fa fa-battery-half" :
                                this.Thermometer.battery >= 15 ? "fa fa-battery-quarter" :
                                "fa fa-battery-empty"
        batteryValue.textContent = this.Thermometer.battery + "%"
      }
    zone2.appendChild(battery)

      var tempTendency = document.createElement("div")
      tempTendency.id = "TUYA_THERMO_TEMP_TENDENCY"
      if (!this.config.display.tendency) tempTendency.className = "hidden"
      else tempTendency.className= this.tempTendency(this.Thermometer.tendency)

    zone2.appendChild(tempTendency)

      var humidity = document.createElement("div")
      humidity.id = "TUYA_THERMO_HUMIDITY"
      var humidityIcon = document.createElement("div")
      humidityIcon.id = "TUYA_THERMO_HUMIDITY_ICON"
      humidity.appendChild(humidityIcon)
      var humidityValue = document.createElement("div")
      humidityValue.id = "TUYA_THERMO_HUMIDITY_VALUE"
      if (!this.config.display.humidity) {
        humidityValue.className = "hidden"
        humidityIcon.className = "hidden"
      } else {
        humidityIcon.className= "fas fa-droplet"
        humidityValue.textContent = this.Thermometer.humidity + "%"
      }
      humidity.appendChild(humidityValue)
    zone2.appendChild(humidity)

    temp.appendChild(zone2)
    wrapper.appendChild(temp)

    return wrapper
  },

  getStyles: function () {
    return [
      "MMM-TuyaThermometer.css",
      "font-awesome.css"
    ]
  },

  socketNotificationReceived: function (noti, payload) {
    switch(noti) {
      case "DATA":
        if (!payload) return console.error("[TUYATH] No Data!")
        this.Thermometer = payload
        logTY("DATA:", this.Thermometer)
        this.updateDom()
        break
    }
  },

  notificationReceived: function(noti, payload) {
    switch(noti) {
      case "DOM_OBJECTS_CREATED":
        if (this.config.debug) logTY = (...args) => { console.log("[TUYATH]", ...args) }
        if (this.config.updateInterval < 5) this.config.updateInterval=5
        this.sendSocketNotification("INIT", this.config)
        break
    }
  },

  tempTendency: function(tendency) {
    let icon
    if (tendency == 1 ) icon = "fa fa-caret-up"
    else if (tendency == 2) icon = "fa fa-caret-down"
    else icon = "fa fa-caret-right"
    return icon
  }

});
