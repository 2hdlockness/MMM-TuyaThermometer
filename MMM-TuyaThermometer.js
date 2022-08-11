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
    this.Thermometer = null
  },

  getDom: function() {
    var wrapper = document.createElement("div")
    wrapper.id = "TUYA_THERMO"
    wrapper.className= this.config.deviceId

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
      tempValue.innerHTML = "--.-°"
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
    zone2.appendChild(battery)

      var tempTendency = document.createElement("div")
      tempTendency.id = "TUYA_THERMO_TEMP_TENDENCY"
    zone2.appendChild(tempTendency)

      var humidity = document.createElement("div")
      humidity.id = "TUYA_THERMO_HUMIDITY"
      var humidityIcon = document.createElement("div")
      humidityIcon.id = "TUYA_THERMO_HUMIDITY_ICON"
      humidity.appendChild(humidityIcon)
      var humidityValue = document.createElement("div")
      humidityValue.id = "TUYA_THERMO_HUMIDITY_VALUE"
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
        this.updateData(payload)
        break
    }
  },

  notificationReceived: function(noti, payload) {
    switch(noti) {
      case "DOM_OBJECTS_CREATED":
        if (this.config.debug) logTY = (...args) => { console.log("[TUYATH]", ...args) }
        this.prepareDisplay()
        if (this.config.updateInterval < 1) this.config.updateInterval=1
        this.sendSocketNotification("INIT", this.config)
        break
    }
  },

  updateData: function(data) {
    if (!data) return console.error("[TUYATH] No Data!")
    this.Thermometer = data
    logTY("DATA:", this.Thermometer)

    var batteryIcon = document.getElementById("TUYA_THERMO_BATTERY_ICON")
    var batteryValue = document.getElementById("TUYA_THERMO_BATTERY_VALUE")
    var humidityIcon = document.getElementById("TUYA_THERMO_HUMIDITY_ICON")
    var humidityValue = document.getElementById("TUYA_THERMO_HUMIDITY_VALUE")
    var tempTendency = document.getElementById("TUYA_THERMO_TEMP_TENDENCY")
    var temp = document.getElementById("TUYA_THERMO_TEMP")
    var tempValue = document.getElementById("TUYA_THERMO_TEMP_VALUE")

    tempValue.textContent = this.Thermometer.temp.toFixed(1) + "°"
    if (this.config.display.tendency) {
      tempTendency.className= this.tempTendency(this.Thermometer.tendency)
    }

    if (this.config.display.humidity) {
      humidityIcon.className= "fas fa-droplet"
      humidityValue.textContent = this.Thermometer.humidity + "%"
    }

    if (this.config.display.battery) {
      batteryIcon.className = this.Thermometer.battery > 95 ? "fa fa-battery-full" :
                              this.Thermometer.battery >= 70 ? "fa fa-battery-three-quarters" :
                              this.Thermometer.battery >= 45 ? "fa fa-battery-half" :
                              this.Thermometer.battery >= 15 ? "fa fa-battery-quarter" :
                              "fa fa-battery-empty"
      batteryValue.textContent = this.Thermometer.battery +"%"
    }
  },

  tempTendency: function(tendency) {
    let icon
    if (tendency == 1 ) icon = "fa fa-caret-up"
    else if (tendency == 2) icon = "fa fa-caret-down"
    else icon = "fa fa-caret-right"
    return icon
  },

  prepareDisplay: function() {
    var tuya = document.getElementById("TUYA_THERMO")
    var batteryIcon = document.getElementById("TUYA_THERMO_BATTERY_ICON")
    var batteryValue = document.getElementById("TUYA_THERMO_BATTERY_VALUE")
    var humidityIcon = document.getElementById("TUYA_THERMO_HUMIDITY_ICON")
    var humidityValue = document.getElementById("TUYA_THERMO_HUMIDITY_VALUE")
    var tempTendency = document.getElementById("TUYA_THERMO_TEMP_TENDENCY")

    if (this.config.display.fixed) {
      tuya.classList.add("fixed")
    }

    if (!this.config.display.battery) {
      batteryIcon.className = "hidden"
      batteryValue.className = "hidden"
    }
    if (!this.config.display.humidity) {
      humidityIcon.className = "hidden"
      humidityValue.className = "hidden"
    }
    if (this.config.display.tendency)
      tempTendency.className = "hidden"
    }
});
