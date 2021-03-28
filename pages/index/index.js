import mqtt from '../../utils/mqtt/mqtt.min.js';
import QQMapWX from '../../utils/map/qqmap-wx-jssdk.min.js';

//连接的服务器域名，注意格式！！！ 867959033013358
const host = 'wxs://aligenie.xuhong.com/mqtt';
var qqmapsdk;

// key：GARBZ-PQ4EW-6CUR6-OJJWY-2APKQ-HEFFK
// 转换请求：https://lbs.qq.com/webservice_v1/guide-convert.html 
// 根据坐标转换: https://lbs.qq.com/qqmap_wx_jssdk/method-reverseGeocoder.html
// 微信 腾讯地图开发文档：https://developers.weixin.qq.com/miniprogram/dev/component/map.html
Page({
  data: {
    deviceIMEI:'',
    hiddenmodalput: true,
    client: null,
    //记录重连的次数
    reconnectCounts: 0,
    devSubTopic: '',
    //MQTT连接的配置
    options: {   
      protocolVersion: 4, //MQTT连接协议版本
      clientId: '',
      clean: true,
      password: 'admin',
      username: 'admin',
      reconnectPeriod: 1000, //1000毫秒，两次重新连接之间的间隔
      connectTimeout: 30 * 1000, //1000毫秒，两次重新连接之间的间隔
      resubscribe: true //如果连接断开并重新连接，则会再次自动订阅已订阅的主题（默认true）
    },
    latitude: 23.099994,
    longitude: 113.324520,
    markers: [{
      iconPath: '../resource/location.png',
      id: 0,
      latitude: 23.099994,
      longitude: 113.324520,
      width: 50,
      height: 50,
      callout: {
        fontSize: 15,
        padding: 3,
        borderRadius: 3,
        color: "#2F4F4F",
        bgColor: "#E6E6FA",
        content: '',
        display: 'ALWAYS'
      }
    }],
  },
  inputDeviceIMEI(e) {
    this.setData({
      deviceIMEI: e.detail.value
    })
  },
  //弹窗确认点击事件回调
  confirm() {
    this.setData({
      hiddenmodalput: true
    })

    let that = this;

    that.data.client.subscribe('/A9g/' + that.data.deviceIMEI + '/update', function (err, granted) {
      if (!err) {
        that.setData({
          devSubTopic: '/A9g/' + that.data.deviceIMEI + '/get'
        })
        wx.showToast({
          title: '正在获取【' + that.data.deviceIMEI + "】的位置",
          icon: 'none',
          duration: 1000
        })

        that.setData({
          deviceIMEI: ''
        })

        that.onClickRefresh()

      } else {
        console.log('订阅报错：' + err)
      }
    })

   
    
  },
  cancel() {
    this.setData({
      hiddenmodalput: true
    })
  },
  onClickInput(){
    this.setData({
      hiddenmodalput: false
    });
  },
  onClickScan: function () {
    let that = this;
    if (this.data.client && this.data.client.connected) {
      wx.scanCode({
        success: (res) => {
          if (res.errMsg === 'scanCode:ok') {
            that.data.client.subscribe('/Ca-01/' + res.result + '/devSub', function(err, granted) {
              if (!err) {
                that.setData({
                  devSubTopic: '/Ca-01/' + res.result + '/devPub'
                })
                wx.showToast({
                  title: '正在获取【' + res.result + "】的位置",
                  icon: 'none',
                  duration: 1000
                })
              } else {
                console.log('订阅报错：' + err)
              }
            })
          } else
            wx.showToast({
              title: '抱歉，请认准在安信可模组上面的二维码。',
              icon: 'none',
              duration: 2000
            })
        },
        fail: (res) => {
          console.log(res);
          wx.showToast({
            title: '抱歉，重新扫描。',
            icon: 'none',
            duration: 2000
          })
        }
      })
    } else {
      wx.showToast({
        title: '请先连接服务器',
        icon: 'none',
        duration: 2000
      })
    }
  },
  onClickRefresh: function ()  {
    console.log("this.data.devSubTopic:" + this.data.devSubTopic)
    if (this.data.client && this.data.client.connected) {
      let data = new Object;``
      data.cmd = 'refresh';
      if (this.data.devSubTopic) {
        this.data.client.publish(this.data.devSubTopic, JSON.stringify(data),{qos:1});
        wx.showToast({
          title: '发布成功'
        })
      } else
        wx.showToast({
          title: '请先添加设备',
          icon: 'none',
          duration: 2000
        })
    } else {
      wx.showToast({
        title: '请先连接服务器',
        icon: 'none',
        duration: 2000
      })
    }
  },
  onLoad: function() {
    var that = this;
    //获取当前时间戳 设置为 clientID
    var timestamp = (new Date()).valueOf();
    this.setData({
      'options.clientId': "WC-" + timestamp
    })

    //开始连接
    this.data.client = mqtt.connect(host, this.data.options);
    this.data.client.on('connect', function(connack) {
      wx.showToast({
        title: 'connect success',
        icon: 'none',
        duration: 2000
      })
    })
    //服务器下发消息的回调
    that.data.client.on("message", function(topic, payload) {
      console.log(" 收到 topic:" + topic + " , payload :" + payload);
      let obj = JSON.parse(payload);
      if (obj) {
        let isGet = obj.code === 1 ? true : false;
        console.log(" 收到 isGet:" + isGet);
        if (isGet) {
          that.translate(obj.Lat, obj.Lon);
          wx.showToast({
            title: '正在定位...',
            icon: 'none',
            duration: 2000
          })
        }else
          wx.showToast({
            title: '设备定位中，请稍后重试..',
            icon: 'none',
            duration: 2000
          })
      }
    })
    //服务器连接异常的回调
    that.data.client.on("error", function(error) {
      console.log(" 服务器 error 的回调" + error)
    })
    //服务器重连连接异常的回调
    that.data.client.on("reconnect", function() {
      //console.log(" 服务器 reconnect的回调")
    })
    //服务器连接异常的回调
    that.data.client.on("offline", function(errr) {
      //console.log(" 服务器offline的回调")
    })


    // 实例化API核心类
    qqmapsdk = new QQMapWX({
      key: 'GARBZ-PQ4EW-6CUR6-OJJWY-2APKQ-HEFFK'
    });

  },
  translate: function(latitude, longitude) {
    var that = this;
    let info = latitude + ',' + longitude;
    wx.request({
      url: 'https://apis.map.qq.com/ws/coord/v1/translate',
      method: "GET",
      data: { //发送给后台的数据
        locations: info,
        type: 1,
        key: 'GARBZ-PQ4EW-6CUR6-OJJWY-2APKQ-HEFFK',
      },
      success: function(res) {
        that.setData({
          latitude: res.data.locations[0].lat,
          longitude: res.data.locations[0].lng,
          'markers[0].latitude': res.data.locations[0].lat,
          'markers[0].longitude': res.data.locations[0].lng,
        })
        qqmapsdk.reverseGeocoder({
          location: {
            latitude: res.data.locations[0].lat,
            longitude: res.data.locations[0].lng
          },
          success: function(res) { //成功后的回调
            console.log(JSON.stringify(res));
            if (res.status === 0) {
              let getRecommend = res.result.recommend === '' ? true : false;
              if (getRecommend) {
                that.setData({
                  'markers[0].callout.content': res.result.address + res.result.formatted_addresses.recommend,
                  'markers[0].callout.display': 'ALWAYS'
                })
              } else
                that.setData({
                  'markers[0].callout.content': res.result.address_component.nation +
                    res.result.address_component.province +
                    res.result.address_component.city +
                    res.result.formatted_addresses.recommend,
                  'markers[0].callout.display': 'ALWAYS'
                })
            }
          },
          fail: function(error) {
            console.error(error);
          },
          complete: function(res) {
            console.log(res);
          }
        });

        //console.log(" res.data.locations[0].lat:" + res.data.locations[0].lat);
        //console.log(" longitude: res.data.locations[0].lng:" + res.data.locations[0].lng);

      },
      fail: function(err) {}, //请求失败
      complete: function() {} //请求完成后执行的函数
    })
  }
})