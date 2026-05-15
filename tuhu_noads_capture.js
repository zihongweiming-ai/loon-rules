/*
途虎养车去广告-抓包精准版
基于抓包命中的接口：
1. mkt-scene-marketing-service/api/scene/queryScheme：开屏广告/启动页营销
2. homePage/getHomePageInfo：首页通栏、轮播、底部券提醒
3. tabBarService/getNewTabBars：Tab 红点、火箭浮标
4. getIndexNotReadNum：消息角标
5. getModuleConfigList / getConfiguration：模块配置里的营销/浮层/活动模块
原则：不删除商品图片字段，不删除商品列表，不处理订单/支付/预约/门店等核心数据。
*/

const url = $request.url || "";

function L(s) {
  return String(s || "").toLowerCase();
}

function safeParse(body) {
  try { return JSON.parse(body); } catch (e) { return null; }
}

function ok(data) {
  return {
    code: 10000,
    message: "操作成功",
    data: data,
    success: true
  };
}

function isAdModuleName(name) {
  const s = String(name || "");
  return /券提醒|底部横条|多坑轮播|开机屏|开屏|弹窗|浮层|广告|营销弹窗|启动页/.test(s);
}

function isHomeBannerModule(name) {
  const s = String(name || "");
  return /算法版1切3通栏|多帧位轮播通栏/.test(s);
}

function cleanHomePage(data) {
  if (!data || typeof data !== "object") return data;

  if (data.cmsInfo && Array.isArray(data.cmsInfo.cmsList)) {
    data.cmsInfo.cmsList = data.cmsInfo.cmsList.filter(m => {
      const name = m && m.moduleName;
      // 去掉抓包中明确出现的首页广告/底部券提醒模块
      if (isAdModuleName(name)) return false;
      if (isHomeBannerModule(name)) return false;
      if (m && (m.moduleTypeId === 173 || m.moduleId === 173)) return false; // 券提醒-底部横条
      if (m && (m.moduleTypeId === 119 || m.moduleTypeId === 120)) return false; // 首页轮播/通栏
      return true;
    });
  }

  // 保留猜你喜欢商品图，不动 aggregationResponseMap 里的 PRODUCT 数据
  return data;
}

function cleanTabBars(data) {
  if (!data || typeof data !== "object") return data;

  // 火箭浮标/活动入口
  if ("rocketUrl" in data) data.rocketUrl = null;

  // 底部 Tab 红点
  if ("redPoint" in data) {
    data.redPoint = {
      type: 0,
      msg: "",
      jumpParam: null,
      location: "",
      fatigue: 0,
      fatigueInfoList: []
    };
  }

  // 递归清理 redPoint / badge
  function walk(o) {
    if (Array.isArray(o)) {
      o.forEach(walk);
    } else if (o && typeof o === "object") {
      for (const k of Object.keys(o)) {
        const lk = L(k);
        if (/redpoint|badge|unread|bubble|dot/.test(lk)) {
          if (typeof o[k] === "number") o[k] = 0;
          else if (typeof o[k] === "string") o[k] = "";
          else if (Array.isArray(o[k])) o[k] = [];
          else if (o[k] && typeof o[k] === "object") o[k] = {};
          else o[k] = null;
        } else {
          walk(o[k]);
        }
      }
    }
  }
  walk(data);
  return data;
}

function cleanModuleConfig(data) {
  if (!data || typeof data !== "object") return data;

  const adCode = /(activitytip|playactivity|customerfloat|cmsbanner|popup|popbox|splash|openad|float|floating|marketing|advert|adbanner|operationad|recommendad)/i;

  function filterModuleInfos(o) {
    if (Array.isArray(o)) {
      return o.filter(item => {
        if (!item || typeof item !== "object") return true;
        const code = String(item.moduleCode || "");
        const name = String(item.moduleName || "");
        // 只移除明显营销/浮层模块，不移除 sku_module_banner 这类商品详情正常图模块
        if (/sku_module_banner/i.test(code)) return true;
        if (/product|sku|goods|order|address|pay|coupon|price|shop|store/i.test(code)) return true;
        return !(adCode.test(code) || adCode.test(name));
      }).map(filterModuleInfos);
    }

    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) {
        if (k === "moduleInfos" && Array.isArray(o[k])) {
          o[k] = filterModuleInfos(o[k]);
        } else {
          o[k] = filterModuleInfos(o[k]);
        }
      }
    }
    return o;
  }

  return filterModuleInfos(data);
}

function cleanConfiguration(data) {
  if (!data || typeof data !== "object") return data;

  const removeKeys = /(splash|openad|screenad|popup|popbox|floatwindow|floating|advert|advertise|adinfo|adlist|marketingpopup|activitypopup|couponpopup|redpoint)/i;

  for (const k of Object.keys(data)) {
    if (removeKeys.test(k)) {
      if (Array.isArray(data[k])) data[k] = [];
      else if (data[k] && typeof data[k] === "object") data[k] = {};
      else if (typeof data[k] === "boolean") data[k] = false;
      else if (typeof data[k] === "number") data[k] = 0;
      else data[k] = "";
    }
  }
  return data;
}

let body = $response.body;
let obj = safeParse(body);

if (obj) {
  if (/mkt-scene-marketing-service\/api\/scene\/queryScheme/.test(url)) {
    // 该接口在抓包里返回 launch_screen 开机屏：moduleActionList 内含 splashScreenMaterial
    obj = ok(null);
  } else if (/mkt-scene-marketing-service\/api\/scene\/scheme\/check/.test(url)) {
    obj = ok({ schemeCheckResultList: [] });
  } else if (/mkt-advertisement-service\/ext\/advertisement\/see\/openapp/.test(url)) {
    obj = {
      code: "10000",
      data: {
        MediaData: "{\"flag\":false,\"openappSwitch\":\"0\",\"default_url\":\"\"}"
      },
      message: "操作成功",
      success: "true"
    };
  } else if (/mkt-push-message-box\/api\/getIndexNotReadNum/.test(url)) {
    obj = { code: 10000, message: "SUCCESS", data: "0" };
  } else if (/cl-usually-api\/popup\/getRetainPopupInfo/.test(url)) {
    obj = ok(null);
  } else if (/homePage\/getHomePageInfo/.test(url)) {
    if (obj.data) obj.data = cleanHomePage(obj.data);
  } else if (/tabBarService\/getNewTabBars/.test(url)) {
    if (obj.data) obj.data = cleanTabBars(obj.data);
  } else if (/moduleConfig\/getModuleConfigList/.test(url)) {
    if (obj.data) obj.data = cleanModuleConfig(obj.data);
  } else if (/cl-app-config-query\/query\/getConfiguration/.test(url)) {
    if (obj.data) obj.data = cleanConfiguration(obj.data);
  }

  body = JSON.stringify(obj);
}

$done({ body });
