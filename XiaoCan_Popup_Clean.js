/*******************************
 * XiaoCan Popup Clean for Loon
 * Based on 2026-06-22 capture
 * 作用：去除小蚕霸王餐/会员/营销弹窗、悬浮窗、广告位
 *******************************/

(function () {
  const url = ($request && $request.url) || '';
  const rawBody = ($response && $response.body) || '';

  if (!rawBody) return $done({});

  let obj;
  try {
    obj = JSON.parse(rawBody);
  } catch (e) {
    return $done({ body: rawBody });
  }

  const method = getHeader('methodname') || getHeader('MethodName') || '';

  try {
    if (/gw\.xiaocantech\.com\/rpc/.test(url)) {
      cleanRpc(obj, method);
    } else if (/realtech-inc\.com|xinyifm\.cn/.test(url)) {
      cleanConfig(obj);
    }
  } catch (e) {
    // 出错时返回原数据，避免影响 App 正常打开
    return $done({ body: rawBody });
  }

  return $done({ body: JSON.stringify(obj) });

  function getHeader(name) {
    const headers = ($request && $request.headers) || {};
    const target = String(name).toLowerCase();
    for (const k of Object.keys(headers)) {
      if (String(k).toLowerCase() === target) return headers[k];
    }
    return '';
  }

  function cleanRpc(data, methodName) {
    // 1. 穿山甲/聚合广告位
    if (methodName === 'AdMobileService.MatchPlacement' || data?.data?.ad_open === 1) {
      data.status = data.status || { code: 0 };
      data.data = Object.assign({}, data.data, {
        ad_open: 0,
        ad_type: [],
        ad_source: [],
        android_ad_id: '',
        android_slot_id: '',
        ios_ad_id: '',
        ios_slot_id: '',
        ad_photo: '',
        resource_id: 0,
        put_id: 0,
        abtest_id: 0,
        tracing: ''
      });
      return;
    }

    // 2. 资源位：弹窗、浮窗、广告 Banner、会员营销图
    if (methodName === 'PlacementMatchService.BatchMatchPlacement' || Array.isArray(data?.resources)) {
      cleanPlacement(data);
      return;
    }

    // 3. 明确的弹窗接口
    if (/Popup|PopUp/i.test(methodName)) {
      cleanPopupResponse(data, methodName);
      return;
    }

    // 4. 首页营销弹层/强弹/抽奖/礼包
    if (methodName === 'SilkwormMobileMarketingService.GetUserMarketingInfoV2') {
      cleanMarketing(data);
      return;
    }

    // 5. 会员升级保护提示，容易触发会员弹窗
    if (methodName === 'SilkwormVipMobile.GetVipLevelUpOrProtectTips') {
      data.status = data.status || { code: 0 };
      data.tips = null;
      return;
    }

    // 6. 用户信息里把会员弹窗标记压掉
    if (methodName === 'ExploreMobile.GetExpertUser' && data.user) {
      data.user.vip_pop_up = 0;
      return;
    }
  }

  function cleanPlacement(data) {
    if (!Array.isArray(data.resources)) return;

    const blockedSlugs = new Set([
      // 抓包中明确与弹窗/浮窗/广告有关
      'UPGRADE_POPUP',
      'OPS_POPUP',
      'POPUP_NEW',
      'MEMBER_FLOATING_WINDOW',
      'BQT_BANNER_AD',
      'MEMBER_CUBEBANNER',
      'VIP_BANNER',
      'VIP_LIMIT_TIME',
      'VIP_PREMIUM',
      'VIDEOVIP_PIC',
      'SVIP_PIC',
      'SVIP_BENEFITS',
      // 开屏/新手视频/首页营销动图，容易伪装成弹层
      'NEW_USER_VIDEO',
      'UP_FRIST_PAGE_GIF'
    ]);

    data.status = data.status || { code: 0 };
    data.resources = data.resources.map((item) => {
      const slug = String(item?.resource_slug || '');
      if (blockedSlugs.has(slug) || /POPUP|FLOATING|BANNER_AD|UPGRADE/i.test(slug)) {
        return emptyResource(item, slug);
      }

      // 对保留的资源位，只清理内部“弹窗/悬浮/自动跳转”字段，不清空核心列表
      if (Array.isArray(item.value)) {
        item.value = item.value.map((v) => cleanPlacementValue(v));
      }
      return item;
    });
  }

  function emptyResource(item, slug) {
    return {
      resource_id: 0,
      value: null,
      status: { code: 0 },
      resource_slug: slug || item?.resource_slug || ''
    };
  }

  function cleanPlacementValue(v) {
    if (!v || typeof v !== 'object') return v;
    if (typeof v.content === 'string') {
      try {
        const contentObj = JSON.parse(v.content);
        cleanConfig(contentObj);
        v.content = JSON.stringify(contentObj);
      } catch (_) {}
    }
    return v;
  }

  function cleanPopupResponse(data, methodName) {
    data.status = data.status || { code: 0 };
    data.status.code = 0;

    // VipPopup：返回“已展示”，防止 App 继续弹
    if (methodName === 'SilkwormVipMobile.VipPopup') {
      let popupTypes = [5];
      try {
        const reqBody = JSON.parse(($request && $request.body) || '{}');
        if (Array.isArray(reqBody.popup_types) && reqBody.popup_types.length) popupTypes = reqBody.popup_types;
      } catch (_) {}
      data.list = popupTypes.map((t) => ({ is_showed: true, popup_type: t }));
      return;
    }

    if (methodName === 'SilkwormVipMobile.RebornCouponPopup') {
      data.data = { is_showed: true, expire_time: 0 };
      return;
    }

    if (methodName === 'ChallengeService.MAChallengePopUp') {
      data.data = { id: 0, pop_up: null, record_id: 0, challenge_action: null, vip_pop_up: null, ma_type: 0 };
      return;
    }

    if (methodName === 'SilkwormFreeOrderClient.HomePopup') {
      Object.assign(data, {
        promotion_order_id: 0,
        free_status: 0,
        helpers: null,
        amount: 0,
        attend_time: 0,
        order_id: '',
        order_info: null,
        end_time: 0
      });
      return;
    }

    // 新人、取消订单、会员激活等弹窗统一关闭
    if ('show' in data) data.show = false;
    if ('info' in data) data.info = null;
    if ('order_tip' in data) data.order_tip = null;
    if ('users' in data) data.users = null;
    if ('left_quota' in data) data.left_quota = 0;
    if (data.activity && typeof data.activity === 'object') {
      data.activity.show = false;
      data.activity.users = null;
      data.activity.is_new_user = false;
    }

    cleanMarketing(data);
  }

  function cleanMarketing(data) {
    const falseKeys = new Set([
      'if_receive_add_gift',
      'if_promotion_muster',
      'if_force_screen',
      'if_celebrate',
      'if_pop_up',
      'if_receive_gift',
      'if_page_gift',
      'if_show_free_lottery',
      'if_lottery',
      'if_show_course',
      'if_order_show_course',
      'show',
      'is_show',
      'open_popup',
      'need_popup'
    ]);

    walk(data, (obj, key) => {
      if (falseKeys.has(key)) obj[key] = false;
      if (key === 'pop_up' || key === 'vip_pop_up' || key === 'popup' || key === 'dialog') obj[key] = null;
      if (key === 'is_showed') obj[key] = true;
      if (key === 'lottery_number' || key === 'receive_gift' || key === 'receive_promotion_number') obj[key] = 0;
    });
  }

  function cleanConfig(data) {
    const badText = /(弹窗|悬浮|强弹|开屏|广告|升级弹|会员弹|popup|pop_up|floating|splash|interstitial)/i;

    walk(data, (obj, key) => {
      const val = obj[key];
      const lowerKey = String(key).toLowerCase();

      if (lowerKey === 'ad_open') obj[key] = 0;
      if (lowerKey === 'is_showed') obj[key] = true;
      if (/^(show|is_show|if_show|if_pop_up|need_popup|open_popup)$/.test(lowerKey)) obj[key] = false;
      if (/popup|pop_up|floating|splash|interstitial/.test(lowerKey)) {
        if (typeof val === 'boolean') obj[key] = false;
        else if (typeof val === 'number') obj[key] = 0;
        else if (Array.isArray(val)) obj[key] = [];
        else obj[key] = null;
      }
      if (typeof val === 'string' && badText.test(val)) {
        // 文案类字段清空，URL 不动，避免破坏正常跳转
        if (!/^https?:|^\//.test(val)) obj[key] = '';
      }
    });
  }

  function walk(node, visitor) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item, visitor);
      return;
    }
    for (const key of Object.keys(node)) {
      visitor(node, key);
      walk(node[key], visitor);
    }
  }
})();
