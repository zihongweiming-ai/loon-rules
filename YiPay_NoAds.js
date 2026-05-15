/******************************
 * 翼支付 App 去广告 - Loon 脚本
 * 作用：清空开屏/权益弹窗广告返回体，保留接口成功结构，降低卡加载概率。
 ******************************/

const url = $request.url || "";
let body = $response.body || "";

try {
  if (body) {
    let obj = JSON.parse(body);

    // 抓包命中：mapi-app.bestpay.com.cn/gapi/appClient/noEnc/unionOpenAds
    // 原始返回字段：result.openAds / result.mallAds / result.externalAdvInfo
    if (/\/gapi\/appClient\/noEnc\/unionOpenAds(?:\?|$)/.test(url)) {
      obj.success = true;
      obj.errorCode = null;
      obj.errorMsg = null;

      if (!obj.result || typeof obj.result !== "object") obj.result = {};
      obj.result.openAds = null;
      obj.result.mallAds = null;
      obj.result.externalAdvInfo = null;

      // 防止部分版本读取遗留广告字段
      const adKeys = [
        "advPositionId", "smallImage", "bigImage", "embeddingClickUrl", "url",
        "advertiseType", "advertiseName", "advFileUrl", "advCreativeTitle",
        "materialId", "advRequestId", "embeddingExposeUrl"
      ];
      for (const key of adKeys) {
        if (Object.prototype.hasOwnProperty.call(obj.result, key)) obj.result[key] = null;
      }
    }

    body = JSON.stringify(obj);
  }
} catch (e) {
  // 不是 JSON 或被压缩异常时保持原样，避免影响正常功能。
}

$done({ body });
