/*
旅行极速版 / 携程旅行去广告净化脚本
用途：清理接口返回里的开屏、弹窗、banner、营销、推荐、广告字段。
*/

function isAdKey(key) {
  if (!key) return false;
  const k = String(key).toLowerCase();
  return /(advert|advertise|advertisement|adlist|ad_list|adinfo|ad_info|ads|^ad$|banner|banners|splash|launch|popup|popups|poplayer|pop_layer|float|floating|marketing|promotion|promote|recommendad|materialad|material_ad|tripads|trip_ads|loadingpicture|loading_picture|feedad|feed_ad|campaign|couponbanner|activitybanner|searchbanner)/.test(k);
}

function isAdString(value) {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return /(ma-adx\.ctrip\.com|tripads|advert|advertise|splash|popup|poplayer|marketing|promotion|banner|activitybanner|couponbanner|feedad|adlist|adinfo)/.test(v);
}

function shouldDropObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;

  const keys = Object.keys(obj);
  const keyText = keys.join("|").toLowerCase();

  if (/(adid|ad_id|adtype|ad_type|advertid|advert_id|materialid|material_id|creativeid|creative_id|exposureurl|clickurl|click_url|monitorurl|trackurl|track_url|maadx|ma_adx)/.test(keyText)) {
    return true;
  }

  if (/(splash|popup|pop|banner|float|marketing|promotion|advert|ad|campaign|activity)/.test(keyText)) {
    const text = JSON.stringify(obj).toLowerCase();
    if (/(image|img|pic|url|jump|link|show|close|countdown|button|expo|track|monitor|ma-adx|ctrip)/.test(text)) {
      return true;
    }
  }

  for (const k of keys) {
    if (isAdString(obj[k])) return true;
  }

  return false;
}

function clean(obj) {
  if (Array.isArray(obj)) {
    const arr = [];
    for (const item of obj) {
      if (shouldDropObject(item)) continue;
      const cleaned = clean(item);
      if (cleaned !== undefined && cleaned !== null) arr.push(cleaned);
    }
    return arr;
  }

  if (obj && typeof obj === "object") {
    if (shouldDropObject(obj)) return null;

    for (const key of Object.keys(obj)) {
      if (isAdKey(key)) {
        if (Array.isArray(obj[key])) obj[key] = [];
        else if (obj[key] && typeof obj[key] === "object") obj[key] = {};
        else delete obj[key];
        continue;
      }

      if (isAdString(obj[key])) {
        delete obj[key];
        continue;
      }

      const cleaned = clean(obj[key]);
      if (cleaned === null) {
        if (Array.isArray(obj[key])) obj[key] = [];
        else if (typeof obj[key] === "object") obj[key] = {};
        else delete obj[key];
      } else {
        obj[key] = cleaned;
      }
    }

    for (const k of Object.keys(obj)) {
      const lk = k.toLowerCase();

      if (/(isshow|show|display|visible|enable|enabled|needshow|need_show)/.test(lk)) {
        const text = JSON.stringify(obj).toLowerCase();
        if (/(splash|popup|advert|ad|banner|marketing|promotion|campaign|activity)/.test(text)) {
          obj[k] = false;
        }
      }

      if (/(countdown|duration|interval|showtime|show_time|delaytime|delay_time)/.test(lk)) {
        const text = JSON.stringify(obj).toLowerCase();
        if (/(splash|popup|advert|ad|banner)/.test(text)) {
          obj[k] = 0;
        }
      }
    }

    return obj;
  }

  return obj;
}

let body = $response.body;

try {
  if (body && typeof body === "string") {
    let data = JSON.parse(body);
    data = clean(data);
    body = JSON.stringify(data);
  }
} catch (e) {
  // 非 JSON 不处理
}

$done({ body });
