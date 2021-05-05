const fs = require('fs-extra')
const path = require('path')
const fetch = require('electron-fetch').default
const { BrowserWindow, app, session } = require('electron')
const ipc = require('electron').ipcMain

const isDev = !app.isPackaged
const appRoot = isDev ? path.resolve(__dirname, '..', '..') : path.resolve(app.getAppPath(), '..', '..')
const userDataPath = path.resolve(appRoot, 'userData')

const saveJSON = async (name, data) => {
  try {
    await fs.outputJSON(path.join(userDataPath, name), data, {
      spaces: 2
    })
  } catch (e) {
    sendLog(e, 'ERROR')
    await sleep(3)
  }
}

const readJSON = async (name) => {
  let data = null
  try {
    data = await fs.readJSON(path.join(userDataPath, name))
  } catch (e) {}
  return data
}

const sleep = (sec = 1) => {
  return new Promise(rev => {
    setTimeout(rev, sec * 1000)
  })
}

const log = []
const sendLog = (text,type) => {
    log.push([Date.now(), type, text])
    saveLog()
}

const saveLog = () => {
  const text = log.map(item => {
    const time = new Date(item[0]).toLocaleString()
    const type = item[1] === 'LOAD_DATA_STATUS' ? 'INFO' : item[1]
    const text = item[2]
    return `[${type}][${time}]${text}`
  }).join('\r\n')
  fs.outputFileSync(path.join(userDataPath, 'log.txt'), text)
}

const requestJson = async (url) => {
  const res = await fetch(url, {
    timeout: 15 * 1000,
    useSessionCookies: true
  })
  return await res.json()
}

const requestRaw = async (url) => {
  const res = await fetch(url, {
    timeout: 15 * 1000,
    useSessionCookies: true
  })
  return await res.text()
}

var HG_ACCOUNT = null
var COOKIE = null
var UID = null
var isarkWindowopen = false

const setHG = async (hg) => {
  try {
    var rsp = await requestRaw("https://ak.hypergryph.com/user/home")
  } catch (e) {
    sendLog("尝试验证 HG_ACCOUNT 失败", "failed")
    return false
  }
  try {
    var uid = rsp.match(/\"uid\":.*?(?=,)/)[0].match(/\d+/)[0]
  } catch (e) {
    sendLog("HG_ACCOUNT 无效", "failed")
    return false
  }
  COOKIE = hg
  UID = uid
  mainWindow.webContents.send('uid', uid)
  mainWindow.webContents.send('log', "HG_ACCOUNT验证成功 uid:"+UID+" 尝试读取现有数据")
  sendLog("HG_ACCOUNT="+COOKIE+" 验证成功 uid: "+UID, "success")
  if (!(arkWindow === null)) {
    arkWindow.close()
  }
  loadData()
  return true
}

const loadData = async () => {
  sleep()
  userGachaList = await readJSON(`gacha-list-${UID}.json`)
  if (userGachaList == null) {
    mainWindow.webContents.send('log', '读取现有数据失败')
    mainWindow.webContents.send('loadfail')
    return false
  } else {
    mainWindow.webContents.send('log', '读取现有数据成功')
    await drawData()
    return true
  }
}

const drawData = async () => {
    await sleep()
    gachaList = await readJSON(`gacha-list-${UID}.json`)
    // 获取日期范围
    var startDate = null
    var endDate = null
    var allgachanum = 0
    var char5_current = 0
    var char4_current = 0
    var char5_historyavg = 0
    var char4_historyavg = 0
    var char5 = null
    var char4 = null
    var char3 = null
    var char2 = null
    var char5_history = ""
    var char4_history = ""
    for (i in gachaList) {
      if (startDate === null | i < startDate) {
        startDate = i
      }
      if (endDate === null | endDate < i) {
        endDate = i
      }
      for (p in gachaList[i]) {
        char5_current += 1
        char4_current += 1
        if (gachaList[i][p]['rarity'] === 2) {
          char2 += 1
        } else if (gachaList[i][p]['rarity'] === 3) {
          char3 += 1
        } else if (gachaList[i][p]['rarity'] === 4) {
          char4 += 1
          // char4_history += `${dateFormat('YYYY-mm-dd HH:MM:SS',i)}\t${gachaList[i][p]['name']}[${char4_current}]\n`
          char4_history += `${gachaList[i][p]['name']}[${char4_current}] `
          char4_historyavg += char4_current
          char4_current = 0
        } else if (gachaList[i][p]['rarity'] === 5) {
          char5 += 1
          // char5_history += `${dateFormat('YYYY-mm-dd HH:MM:SS',i)}\t${gachaList[i][p]['name']}[${char5_current}]\n`
          char5_history += `${gachaList[i][p]['name']}[${char5_current}] `
          char5_historyavg += char5_current
          char5_current = 0
        }
        allgachanum += 1
      }
    }
    startDate = formatDate(startDate)
    endDate = formatDate(endDate)
    var option = {
        title: {
            top: '0%',
            text: `UID: ${UID}`,
            subtext: `${startDate} - ${endDate}`,
            left: 'center'
        },
        tooltip: {
            trigger: 'item'
        },
        legend: {
            top: '12%',
            left: 'center',
        },
        series: [
            {
                type: 'pie',
                radius: '40%',
                data: [
                    {value: char5, name: '6星干员'},
                    {value: char4, name: '5星干员'},
                    {value: char3, name: '4星干员'},
                    {value: char2, name: '3星干员'},
                ],
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ]
    }
    var detail = {
        "allgachanum": allgachanum,
        "char5_current": char5_current,
        "char5_count": char5,
        "char4_count": char4,
        "char3_count": char3,
        "char2_count": char2,
        "char5_percent": Number(char5/allgachanum * 100).toFixed(2)+"%",
        "char4_percent": Number(char4/allgachanum * 100).toFixed(2)+"%",
        "char3_percent": Number(char3/allgachanum * 100).toFixed(2)+"%",
        "char2_percent": Number(char2/allgachanum * 100).toFixed(2)+"%",
        "char5_history": char5_history,
        "char4_history": char4_history,
        "char5_historyavg": Number(char5_historyavg/char5).toFixed(2),
        "char4_historyavg": Number(char4_historyavg/char4).toFixed(2)
    }
    mainWindow.webContents.send('draw', option)
    mainWindow.webContents.send('detail', detail)
    mainWindow.webContents.send('log', `加载完毕`)
}
const getCookie = async () => {
  arkWindow = new BrowserWindow({width:400,height:600})
  arkWindow.loadURL('https://ak.hypergryph.com/user/inquiryGacha')
  arkWindow.on('closed', () => {
    isarkWindowopen = false
    arkWindow = null
  })
  arkWindow.webContents.on('new-window', function(event,url,fname,disposition,options) {
    event.preventDefault()
  })
  arkWindow.webContents.session.cookies.on('changed', () => {
    try {
      arkWindow.webContents.session.cookies.get({}).then((cookies) => {
        for (var cookie in cookies) {
          if (cookies[cookie].name === 'HG_ACCOUNT') {
            var timestamp = Date.parse(new Date())
            if (cookies[cookie].expirationDate*1000 > timestamp) {
              if (cookies[cookie].value != HG_ACCOUNT) {
                HG_ACCOUNT = cookies[cookie].value
                setHG(cookies[cookie].value)
              }
            }
          }
        }
      })
    } catch (e) {
      sendLog(e,'ERROR')
    }
  })
}

var arkWindow = null
var mainWindow = null

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    width:800,
    height:600,
    webPreferences:{nodeIntegration:true,contextIsolation:false}
  })
  mainWindow.loadFile('index.html')
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  // mainWindow.webContents.openDevTools({ mode: 'undocked', activate: true })
})


ipc.on('add',() => {
  if (isarkWindowopen === false) {
    isarkWindowopen = true
    getCookie()
  }
})

const formatDate = (timestamp) => {
    var date = new Date(timestamp*1000)
    var year = date.getFullYear(),
        month = ("0" + (date.getMonth() + 1)).slice(-2),
        sdate = ("0" + date.getDate()).slice(-2)
    // 拼接
    var result = year + "/"+ month +"/"+ sdate
    // 返回
    return result
}

const dateFormat = (fmt, timestamp) => {
    var date = new Date(timestamp*1000)
    let ret;
    const opt = {
        "Y+": date.getFullYear().toString(),        // 年
        "m+": (date.getMonth() + 1).toString(),     // 月
        "d+": date.getDate().toString(),            // 日
        "H+": date.getHours().toString(),           // 时
        "M+": date.getMinutes().toString(),         // 分
        "S+": date.getSeconds().toString()          // 秒
        // 有其他格式化字符需求可以继续添加，必须转化成字符串
    };
    for (let k in opt) {
        ret = new RegExp("(" + k + ")").exec(fmt);
        if (ret) {
            fmt = fmt.replace(ret[1], (ret[1].length == 1) ? (opt[k]) : (opt[k].padStart(ret[1].length, "0")))
        };
    };
    return fmt;
}

const getGachaRecords = async (page) => {
  gachaRecord = await requestJson(`https://ak.hypergryph.com/user/api/inquiry/gacha?page=${page}`)
  userGachaList = await readJSON(`gacha-list-${UID}.json`)
  if (userGachaList == null) {
    userGachaList = {}
  }
  for (i in gachaRecord['data']['list']) {
    record = gachaRecord['data']['list'][i]
    if (!(record['ts'] in userGachaList)) {
      userGachaList[record['ts']] = record['chars']
    } else {
      saveJSON(`gacha-list-${UID}.json`,userGachaList)
      return true
    }
  }
  saveJSON(`gacha-list-${UID}.json`,userGachaList)
  if (gachaRecord['data']['pagination']['total'] > gachaRecord['data']['pagination']['current']*10) {
    return false
  } else {
    return true
  }
}

ipc.on('get',async () => {
  isover = false
  page = 1
  while (isover === false) {
    mainWindow.webContents.send('log', `正在获取第 ${page} 页`)
    isover = await getGachaRecords(page)
    page = page + 1
  }
  mainWindow.webContents.send('log', `获取完毕，正在加载数据`)
  await drawData()
})
