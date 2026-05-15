/*
京东快递 去广告 for Loon
Based on capture: lop-proxy.jd.com
Author: ChatGPT
Note: 保守清理广告/营销位，避免误杀寄件、查件、登录等核心功能。
*/

const url = $request.url;
let body = $response.body || "";

function safeParse(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

function done(obj) {
  $done({ body: JSON.stringify(obj) });
}

let obj = safeParse(body);

if (!obj) {
  $done({});
} else {
  try {
    // 1) 首页开屏/营销推荐规则
    // 抓包命中：queryAppHomePageMarketingRecommendRuleConfigInfo
    // 原返回包含：ruleDesc/ruleName = 京东快递APP首页开屏广告
    if (/\/+queryAppHomePageMarketingRecommendRuleConfigInfo(?:\?|$)/.test(url)) {
      const emptyContent = {
        marketingConfigInfoDto: {},
        ruleBasicInfoDto: {},
        trafficControlInfoDto: { trafficStrategyType: 0 }
      };
      obj.code = obj.code === undefined ? 1 : obj.code;
      obj.success = true;
      obj.errorMsg = "SUCCESS";
      obj.msg = "SUCCESS";
      obj.content = emptyContent;
      obj.data = emptyContent;
      done(obj);

    // 2) 首页 Banner / 京寄卡 / Plus 卡等营销横幅
    // 抓包命中：/config/queryContentListWithPage，resCode=pos00007
    } else if (/\/+config\/queryContentListWithPage(?:\?|$)/.test(url)) {
      if (obj.data && typeof obj.data === "object") {
        obj.data.itemList = [];
        obj.data.currentItemCount = 0;
        obj.data.totalItems = 0;
        obj.data.totalPages = 0;
      }
      obj.success = obj.success === undefined ? true : obj.success;
      done(obj);

    // 3) 首页营销模块，如乡村丰收节、超省钱京寄卡等
    // 抓包命中：queryCmsContentInfo，contentCode=expressapp_online-template-market
    } else if (/\/+queryCmsContentInfo(?:\?|$)/.test(url)) {
      if (obj.data && typeof obj.data === "object") {
        if (typeof obj.data.content === "string") {
          let content = safeParse(obj.data.content);
          if (content && typeof content === "object") {
            const listKeys = [
              "marketList", "bannerList", "adList", "adsList", "popupList",
              "floatList", "floatWindow", "recommendList", "activityList",
              "promotionList", "resourceList", "mulResourceList"
            ];
            for (const key of listKeys) {
              if (Array.isArray(content[key])) content[key] = [];
            }
            obj.data.content = JSON.stringify(content);
          }
        }
      }
      done(obj);

    // 4) 首页主信息里的 Banner / 弹窗 / 浮窗兜底清理
    // 不动 homeGongneng、bottomBar，避免影响寄件/查件等核心入口
    } else if (/\/+queryHomeMainInfo(?:\?|$)/.test(url)) {
      if (obj.content && typeof obj.content === "object") {
        const c = obj.content;
        const keys = [
          "homeBanner", "bannerList", "adList", "adsList", "popupList",
          "floatList", "floatWindow", "marketingList", "recommendAdList"
        ];
        for (const key of keys) {
          if (Array.isArray(c[key])) c[key] = [];
          else if (c[key] && typeof c[key] === "object") c[key] = {};
        }
      }
      if (obj.data && typeof obj.data === "object" && !obj.data.$ref) {
        const d = obj.data;
        const keys = [
          "homeBanner", "bannerList", "adList", "adsList", "popupList",
          "floatList", "floatWindow", "marketingList", "recommendAdList"
        ];
        for (const key of keys) {
          if (Array.isArray(d[key])) d[key] = [];
          else if (d[key] && typeof d[key] === "object") d[key] = {};
        }
      }
      done(obj);

    } else {
      $done({});
    }
  } catch (e) {
    $done({});
  }
}
