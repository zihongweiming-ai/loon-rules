/*
途虎养车去广告-抓包精准V2
修复点：
1. 插件使用 max-size=0，确保 188KB 的首页接口也能被脚本处理
2. 精准处理抓包里的 /launch 开屏广告与 splashScreenMaterial
3. 首页只删 moduleId 119、120、173，不碰猜你喜欢/商品图
4. 不碰订单、支付、门店、预约、商品列表
*/

const url = $request.url || "";

function safeParse(body) {
  try { return JSON.parse(body); } catch (e) { return null; }
}

function ok(data) {
  return { code: 10000, message: "操作成功", data, success: true };
}

function cleanHomePage(data) {
  if (!data || typeof data !== "object") return data;

  if (data.cmsInfo && Array.isArray(data.cmsInfo.cmsList)) {
    data.cmsInfo.cmsList = data.cmsInfo.cmsList.filter(m => {
      if (!m || typeof m !== "object") return true;

      const name = String(m.moduleName || "");
      const mid = Number(m.moduleId || 0);
      const tid = Number(m.moduleTypeId || 0);

      // 抓包中明确广告模块：
      // 120 算法版1切3通栏、119 多帧位轮播通栏、173 券提醒-底部横条-多坑轮播
      if ([119, 120, 173].includes(mid) || [119, 120, 173].includes(tid)) return false;
      if (/算法版1切3通栏|多帧位轮播通栏|券提醒|底部横条|开屏|开机屏|弹窗|浮层|广告/.test(name)) return false;

      return true;
    });
  }

  return data;
}

function cleanTabBars(data) {
  if (!data || typeof data !== "object") return data;

  if ("rocketUrl" in data) data.rocketUrl = null;

  if ("redPoint" in data) {
    data.redPoint = null;
  }

  function walk(o) {
    if (Array.isArray(o)) {
      o.forEach(walk);
      return;
    }
    if (!o || typeof o !== "object") return;

    for (const k of Object.keys(o)) {
      if (/redPoint|badge|unread|bubble|dot|rocketUrl/i.test(k)) {
        if (typeof o[k] === "number") o[k] = 0;
        else if (typeof o[k] === "string") o[k] = "";
        else o[k] = null;
      } else {
        walk(o[k]);
      }
    }
  }
  walk(data);
  return data;
}

function cleanModuleConfig(data) {
  if (!data || typeof data !== "object") return data;

  const adCode = /(activitytip|playactivity|customerfloat|popup|popbox|splash|openad|float|floating|marketing|advert|adbanner|operationad|recommendad|couponbar|noticebar)/i;
  const safeCode = /(sku|product|goods|order|address|pay|coupon|price|shop|store|vehicle|car|tire|battery|oil|menu|search)/i;

  function walk(o) {
    if (Array.isArray(o)) {
      return o.filter(item => {
        if (!item || typeof item !== "object") return true;
        const code = String(item.moduleCode || "");
        const name = String(item.moduleName || "");
        if (safeCode.test(code) || safeCode.test(name)) return true;
        return !(adCode.test(code) || adCode.test(name));
      }).map(walk);
    }

    if (o && typeof o === "object") {
      for (const k of Object.keys(o)) {
        o[k] = walk(o[k]);
      }
    }

    return o;
  }

  return walk(data);
}

function cleanConfiguration(data) {
  if (!data || typeof data !== "object") return data;

  const removeKey = /(splash|openad|screenad|popup|popbox|floatwindow|floating|advert|advertise|adinfo|adlist|marketingpopup|activitypopup|couponpopup|redpoint|rocketurl)/i;
  const safeKey = /(login|token|user|account|order|pay|coupon|price|product|goods|sku|store|vehicle|car|tire|battery|oil)/i;

  for (const k of Object.keys(data)) {
    if (safeKey.test(k)) continue;
    if (removeKey.test(k)) {
      if (Array.isArray(data[k])) data[k] = [];
      else if (data[k] && typeof data[k] === "object") data[k] = {};
      else if (typeof data[k] === "boolean") data[k] = false;
      else if (typeof data[k] === "number") data[k] = 0;
      else data[k] = "";
    }
  }

  return data;
}

let body = $response.body || "";
let obj = safeParse(body);

if (obj) {
  if (/mkt-scene-marketing-service\/api\/scene\/queryScheme/.test(url)) {
    // 抓包中 /launch 返回 0516开机屏，直接清空
    obj = ok(null);
  } else if (/mkt-scene-marketing-service\/api\/scene\/scheme\/check/.test(url)) {
    obj = ok({ schemeCheckResultList: [] });
  } else if (/mkt-advertisement-service\/ext\/advertisement\/see\/openapp/.test(url)) {
    obj = {
      code: "10000",
      data: { MediaData: "{\"flag\":false,\"openappSwitch\":\"0\",\"default_url\":\"\"}" },
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
