/*
小蚕霸王餐去弹窗 for Loon
适配抓包版本：XC iOS 3.16.8
作用：去除首页运营弹窗、升级弹窗、会员弹窗、券包弹窗、广告位弹窗
注意：不拦截订单、抢餐、列表接口，尽量避免影响正常使用。
*/

const headers = $request.headers || {};
const url = $request.url || "";
const methodName = getHeader("methodname");
let body = $response.body || "";

function getHeader(name) {
  const lower = name.toLowerCase();
  for (const key in headers) {
    if (key.toLowerCase() === lower) return String(headers[key] || "");
  }
  return "";
}

function isObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function setFalseIfExists(obj, keys) {
  if (!isObject(obj)) return;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) obj[key] = false;
  }
}

function setZeroIfExists(obj, keys) {
  if (!isObject(obj)) return;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) obj[key] = 0;
  }
}

function cleanCommonPopupFields(obj) {
  if (!isObject(obj)) return obj;

  setFalseIfExists(obj, [
    "show",
    "is_showed",
    "if_pop_up",
    "if_force_screen",
    "if_show_free_lottery",
    "if_page_gift",
    "if_user_record_pop_up",
    "if_receive_add_gift",
    "if_in_app_review",
    "has_event",
    "is_participating_in_the_activity"
  ]);

  setZeroIfExists(obj, [
    "receive_promotion_number",
    "promotion_notify",
    "sign_notify",
    "lottery_number",
    "vip_pop_up",
    "record_id",
    "max_amount",
    "free_status",
    "amount",
    "end_time",
    "promotion_order_id"
  ]);

  if (Object.prototype.hasOwnProperty.call(obj, "info")) obj.info = null;
  if (Object.prototype.hasOwnProperty.call(obj, "users")) obj.users = null;
  if (Object.prototype.hasOwnProperty.call(obj, "order_tip")) obj.order_tip = null;
  if (Object.prototype.hasOwnProperty.call(obj, "helpers")) obj.helpers = null;
  if (Object.prototype.hasOwnProperty.call(obj, "order_info")) obj.order_info = null;
  if (Object.prototype.hasOwnProperty.call(obj, "event")) obj.event = null;
  if (Object.prototype.hasOwnProperty.call(obj, "pop_up")) obj.pop_up = null;
  if (Object.prototype.hasOwnProperty.call(obj, "challenge_action")) obj.challenge_action = null;

  return obj;
}

function removePlacementPopups(obj) {
  if (!isObject(obj)) return obj;

  const blockSlugs = new Set([
    "OPS_POPUP",
    "UPGRADE_POPUP",
    "POPUP_NEW",
    "NEW_USER_VIDEO"
  ]);

  if (Array.isArray(obj.resources)) {
    obj.resources = obj.resources
      .map(group => {
        if (!isObject(group)) return group;
        const slug = String(group.resource_slug || "");

        if (blockSlugs.has(slug) || /POPUP/i.test(slug)) return null;

        if (Array.isArray(group.value)) {
          group.value = group.value.filter(item => {
            const itemSlug = String((item && item.resource_slug) || slug || "");
            return !(blockSlugs.has(itemSlug) || /POPUP/i.test(itemSlug));
          });
        }
        return group;
      })
      .filter(Boolean);
  }

  return obj;
}

function disableAdPlacement(obj) {
  if (!isObject(obj)) return obj;
  if (!isObject(obj.data)) return obj;

  obj.data.ad_open = 0;
  obj.data.ad_type = [];
  obj.data.ad_source = [];
  obj.data.android_ad_id = "";
  obj.data.android_slot_id = "";
  obj.data.ios_ad_id = "";
  obj.data.ios_slot_id = "";
  obj.data.ad_photo = "";
  obj.data.resource_id = 0;
  obj.data.put_id = 0;
  obj.data.abtest_id = 0;
  obj.data.tracing = "";
  return obj;
}

function disableVipPopup(obj) {
  if (!isObject(obj)) return obj;

  if (Array.isArray(obj.list)) {
    obj.list.forEach(item => {
      if (isObject(item)) item.is_showed = false;
    });
  }

  if (isObject(obj.data)) {
    obj.data.is_showed = false;
    obj.data.expire_time = 0;
  }

  return obj;
}

function disableMarketingPopup(obj) {
  if (!isObject(obj)) return obj;

  cleanCommonPopupFields(obj);

  if (isObject(obj.user_marketing)) {
    cleanCommonPopupFields(obj.user_marketing);
    obj.user_marketing.if_in_app_review = false;
    obj.user_marketing.in_app_review_order_count = 999999;
  }

  // 不清空 list_lottery，避免影响签到/抽奖数据；只关闭强弹窗相关字段。
  return obj;
}

try {
  let obj = JSON.parse(body);

  switch (methodName) {
    case "PlacementMatchService.BatchMatchPlacement":
      obj = removePlacementPopups(obj);
      break;

    case "AdMobileService.MatchPlacement":
      obj = disableAdPlacement(obj);
      break;

    case "SilkwormVipMobile.VipPopup":
    case "SilkwormVipMobile.RebornCouponPopup":
      obj = disableVipPopup(obj);
      break;

    case "SilkwormMobileMarketingService.GetUserMarketingInfoV2":
      obj = disableMarketingPopup(obj);
      break;

    case "NewUserMobileService.IsNewUserAndShowPopup":
    case "NewUserMobileService.IsShowActiveVipPopup":
    case "NewUserMobileService.IsShowOrderAwardPopup":
    case "NewUserMobileService.NewMemberPopup":
    case "ChallengeService.MAChallengePopUp":
    case "ChallengeService.UserCityPromotion":
    case "SilkwormFreeOrderClient.HomePopup":
    case "SilkwormMobileLuckRedPackService.GetMainRecommendRedPackActivityInfo":
    case "SilkwormLotteryMobile.GetRedPackRainEvent":
    case "ActivityTaskMobileService.PointConvert":
      obj = cleanCommonPopupFields(obj);
      if (isObject(obj.activity)) cleanCommonPopupFields(obj.activity);
      if (isObject(obj.data)) cleanCommonPopupFields(obj.data);
      if (isObject(obj.result)) cleanCommonPopupFields(obj.result);
      break;

    default:
      // 没有 methodname 时，按响应结构兜底处理几个确定的弹窗结构。
      if (url.includes("/rpc")) {
        if (Array.isArray(obj.resources)) obj = removePlacementPopups(obj);
        if (Array.isArray(obj.list) && obj.list.some(x => x && Object.prototype.hasOwnProperty.call(x, "is_showed"))) obj = disableVipPopup(obj);
        if (isObject(obj.data) && Object.prototype.hasOwnProperty.call(obj.data, "ad_open")) obj = disableAdPlacement(obj);
      }
      break;
  }

  $done({ body: JSON.stringify(obj) });
} catch (e) {
  $done({});
}
