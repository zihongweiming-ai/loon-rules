/*
平安好车主去广告净化脚本
用途：清理接口返回里的首页弹窗、开屏、banner、营销、推荐广告字段。
说明：只对 hcz-member.pingan.com.cn 的响应做 JSON 字段清理。
*/

function isAdKey(key) {
  if (!key) return false;
  const k = String(key).toLowerCase();
  return /(advert|advertise|advertisement|adlist|ad_list|adinfo|ad_info|ads|^ad$|banner|banners|splash|launch|popup|popups|popbox|toppopbox|pop_layer|float|floating|marketing|promotion|promote|recommendad|materialad|material_ad|loadingpicture|loading_picture|feedad|feed_ad|campaign|activitybanner|operation|operate|guidead|guide_ad)/.test(k);
}

function isAdString(value) {
  if (typeof value !== "string") return false;
  const v = value.toLowerCase();
  return /(gettoppopbox|popbox|toppopbox|advert|advertise|splash|popup|banner|marketing|promotion|activitybanner|operation|iobs\.pingan\.com\.cn\/download\/bweb|personalcenterhomepageobm|yoursystemname)/.test(v);
}

function shouldDropObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;

  const keys = Object.keys(obj);
  const keyText = keys.join("|").toLowerCase();

  // 明显广告对象
  if (/(adid|ad_id|adtype|ad_type|advertid|advert_id|materialid|material_id|creativeid|creative_id|exposureurl|clickurl|click_url|monitorurl|trackurl|track_url|popboxid|popupid|campaignid)/.test(keyText)) {
    return true;
  }

  // 弹窗、开屏、营销位对象
  if (/(splash|popup|popbox|pop|banner|float|marketing|promotion|advert|ad|campaign|activity|operation)/.test(keyText)) {
    const text = JSON.stringify(obj).toLowerCase();
    if (/(image|img|pic|url|jump|link|show|close|countdown|button|expo|track|monitor|iobs|pingan)/.test(text)) {
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

    // 尝试关闭广告展示开关
    for (const k of Object.keys(obj)) {
      const lk = k.toLowerCase();

      if (/(isshow|show|display|visible|enable|enabled|needshow|need_show|popshow|showflag)/.test(lk)) {
        const text = JSON.stringify(obj).toLowerCase();
        if (/(splash|popup|popbox|advert|ad|banner|marketing|promotion|campaign|activity|operation)/.test(text)) {
          obj[k] = false;
        }
      }

      if (/(countdown|duration|interval|showtime|show_time|delaytime|delay_time)/.test(lk)) {
        const text = JSON.stringify(obj).toLowerCase();
        if (/(splash|popup|popbox|advert|ad|banner)/.test(text)) {
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
