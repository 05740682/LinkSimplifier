export default {
  async fetch(request, env, ctx) {
    const urlObj = new URL(request.url);
    const path = urlObj.pathname.toLowerCase();

    if (path === "/robots.txt") {
      return new Response("User-agent: *\nDisallow:", {
        headers: { "Content-Type": "text/plain;charset=UTF-8" }
      });
    }

    if (path === "/favicon.ico") {
  return new Response(
    Uint8Array.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff,
      0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b
    ]),
    { headers: { "Content-Type": "image/gif" } }
  );
}

  if (path === "/parse") {
      if (request.method === "POST") {
        try {
          const { url } = await request.json();
          const inputUrl = url ? url.trim() : "";

          if (!inputUrl || !/^https?:\/\//i.test(inputUrl)) {
            return new Response(JSON.stringify({ error: "解析失败: 无效的URL地址" }), {
              status: 400,
              headers: { "Content-Type": "application/json" }
            });
          }

          const host = new URL(inputUrl).hostname.toLowerCase();
          let responseData;

          if (host.includes("mail.qq")) {
            responseData = await processQQMail(inputUrl);
          } else if (host.includes("lanzou")) {
            responseData = await processLanZou(inputUrl);
          } else {
            responseData = { result: inputUrl, cookie: "" };
          }

          return new Response(JSON.stringify(responseData), {
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: "解析失败: 解析请求失败" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
          });
        }
      }
      return new Response("Method Not Allowed", { status: 405 });
    }

    return new Response(renderHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

async function processQQMail(url) {
  const origin = new URL(url).origin;
  const headers = {
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36",
    "Referer": origin
  };

  const getFinalData = async (targetUrl) => {
    const res = await fetch(targetUrl, { headers, redirect: "manual" });
    const rawCookie = res.headers.get("set-cookie") || "";
    const match = rawCookie.match(/mail5k=[^;]+/);

    return {
      result: res.headers.get("location") || targetUrl,
      cookie: match ? match[0] : ""
    };
  };

  const params = new URL(url).searchParams;
  const key = params.get("key");
  const code = params.get("code");

  if (key && code) {
    const directUrl = `https://wx.mail.qq.com/ftn/download?func=4&key=${key}&code=${code}`;
    return await getFinalData(directUrl);
  }

  const timestamp = `${Math.floor(Math.random() * 1e13)}${Date.now()}`;
  const apiResponse = await fetch(`${url}&r=${timestamp}&sid=`, {
    method: "POST",
    headers,
    body: "f=json"
  });

  const data = await apiResponse.json();
  return await getFinalData(data?.body?.url);
}

async function processLanZou(url, password = null) {
  const RegexPatterns = {
    FolderParamRegex: /&folder/i,
    PasswordParamRegex: /&pwd=(.*)/i,
    IframeSrcRegex: /<iframe[^>]*?src\s*=\s*["']?([^"'\s>]*)/i,
    JavaScriptCommentRegex: /(\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)(?=([^"'`]*(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`))*[^"'`]*$)/gm,
    JavaScriptVarRegex: /var\s+(\w+)(?:\s*=\s*([^;]+))?;/gi,
    JavaScriptAssignRegex: /(\w+)\s*=\s*([^;]+);/gi,
    JavaScriptAjaxUrlRegex: /url\s*:\s*'([^']*)'/i,
    JavaScriptAjaxDataRegex: /data\s*:\s*\{\s*([^}]+)\s*\}/si
  };

  if (RegexPatterns.FolderParamRegex.test(url)) {
    return {
      result: "解析失败: 网页版不支持文件夹解析，请提供单文件链接",
      cookie: ""
    };
  }

  const baseUrl = url.replace(RegexPatterns.PasswordParamRegex, "").replace(RegexPatterns.FolderParamRegex, "");
  const domain = new URL(baseUrl).origin;

  const headers = {
    "Accept": "*/*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": baseUrl,
    "Cookie": ""
  };

  try {
    let res = await fetch(baseUrl, { headers });
    let html = await res.text();

    if (ProcessAcwScV2Challenge(html, headers)) {
      html = await (await fetch(baseUrl, { headers })).text();
    }

    let currentReferer = baseUrl;
    const pwdMatch = url.match(RegexPatterns.PasswordParamRegex);
    const finalPassword = password || (pwdMatch ? pwdMatch[1] : null);

    if (!finalPassword) {
      const iframeMatch = html.match(RegexPatterns.IframeSrcRegex);
      if (iframeMatch && iframeMatch[1]) {
        const iframeUrl = iframeMatch[1].startsWith('http') ? iframeMatch[1] : domain + (iframeMatch[1].startsWith('/') ? '' : '/') + iframeMatch[1];
        currentReferer = iframeUrl;
        headers["Referer"] = baseUrl;
        html = await (await fetch(iframeUrl, { headers })).text();
      }
    }

    const cleanHtml = html.replace(RegexPatterns.JavaScriptCommentRegex, "");
    let vars = {};
    const varMatches = cleanHtml.matchAll(RegexPatterns.JavaScriptVarRegex);
    for (const match of varMatches) {
        vars[match[1]] = match[2] ? match[2].trim().replace(/^['"]|['"]$/g, '') : "";
    }
    const assignMatches = cleanHtml.matchAll(RegexPatterns.JavaScriptAssignRegex);
    for (const match of assignMatches) {
        if (vars.hasOwnProperty(match[1])) {
            vars[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
        }
    }
    vars["pwd"] = finalPassword || "";

    const ajaxDataMatch = cleanHtml.match(RegexPatterns.JavaScriptAjaxDataRegex);
    if (!ajaxDataMatch) return { result: "解析失败: 无法提取 AJAX 数据", cookie: "" };

    let formData = new URLSearchParams();
    const dataPairs = ajaxDataMatch[1].split(',');
    dataPairs.forEach(pair => {
      const parts = pair.split(':');
      if (parts.length === 2) {
        const key = parts[0].trim().replace(/^['"]|['"]$/g, '');
        const rawVal = parts[1].trim().replace(/^['"]|['"]$/g, '');
        formData.append(key, vars.hasOwnProperty(rawVal) ? vars[rawVal] : rawVal);
      }
    });

    const ajaxUrlMatch = cleanHtml.match(RegexPatterns.JavaScriptAjaxUrlRegex);
    const postUrl = domain + (ajaxUrlMatch ? ajaxUrlMatch[1] : "");

    headers["Referer"] = currentReferer;
    headers["Content-Type"] = "application/x-www-form-urlencoded";

    const apiRes = await fetch(postUrl, {
      method: 'POST',
      headers: headers,
      body: formData.toString()
    });

    const response = await apiRes.json();

    if (response.zt === 1) {
      const intermediateUrl = `${response.dom}/file/${response.url}`;

      const redirectHeaders = {
        "User-Agent": headers["User-Agent"],
        "Accept-Language": "zh-CN,zh;q=0.9"
      };

      const redirectRes = await fetch(intermediateUrl, {
        method: 'GET',
        headers: redirectHeaders,
        redirect: 'manual'
      });
      const rawLocation = redirectRes.headers.get("Location") || intermediateUrl;
      const finalUrl = decodeURIComponent(rawLocation);

      return {
        result: finalUrl,
        cookie: ""
      };
    } else {
      return {
        result: `解析失败：${response.inf || "解析失败: 密码错误或链接失效"}`,
        cookie: ""
      };
    }

  } catch (error) {
    return { result: `解析失败: 解析过程中出现异常: ${error.message}`, cookie: "" };
  }
}

function ProcessAcwScV2Challenge(html, headers) {
  const match = html.match(/var arg1\s*=\s*'([^']+)'/i);
  if (match) {
    headers["Cookie"] = `acw_sc__v2=${calculateAcwScV2(match[1])}`;
    return true;
  }
  return false;
}

function calculateAcwScV2(arg1) {
  const p = [15, 35, 29, 24, 33, 16, 1, 38, 10, 9, 19, 31, 40, 27, 22, 23, 25, 13, 6, 11, 39, 18, 20, 8, 14, 21, 32, 26, 2, 30, 7, 4, 17, 5, 3, 28, 34, 37, 12, 36];
  const m = "3000176000856006061501533003690027800375";
  let b = new Array(40);
  for (let i = 0; i < 40; i++) {
    for (let j = 0; j < 40; j++) {
      if (p[j] === i + 1) b[j] = arg1[i];
    }
  }
  let res = "";
  const bStr = b.join("");
  for (let i = 0; i < 40; i += 2) {
    res += (parseInt(bStr.substring(i, i + 2), 16) ^ parseInt(m.substring(i, i + 2), 16)).toString(16).padStart(2, '0');
  }
  return res.toLowerCase();
}

function renderHTML() {
	const encodedJS = "Y29uc3QgJD0oaSk9PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGkpLHVpPSQoJ3VybElucHV0JykscGI9JCgncGFyc2VCdG4nKSxkYj0kKCdkb3dubG9hZEJ0bicpLGNiPSQoJ2NsZWFyQnRuJykscnQ9JCgncmVzdWx0VGV4dCcpLHdjPSQoJ3dpbmRvd0NvbnRhaW5lcicpLG1iPSQoJ21heGltaXplQnRuJyksY2xiPSQoJ2Nsb3NlQnRuJyksdGQ9JCgndGltZURpc3BsYXknKSx0Yj0kKCd0YXNrYmFyJyksZ2k9JCgnZ2l0aHViSWNvbicpLG92PSQoJ21vZGFsT3ZlcmxheScpLG1tPSQoJ21vZGFsTXNnJyksd2Q9JCgnd2luRGlhbG9nJyksbWg9JCgnbW9kYWxIZWFkZXInKSxtaT0kKCdtb2RhbEljb24nKTtsZXQgaXNNPSExLG9QPXt4OjAseTowfSxvUz17dzo5MDAsaDo1NTB9LGlzRD0hMSxkWCxkWSxjWCxjWSxjaz0iIixpc01EPSExLG1EWCxtRFksbUNYLG1DWSxpc1A9ITE7Y29uc3Qgd2luQWxlcnQ9KG0saW5mPSExKT0+e21tLnRleHRDb250ZW50PW07b3Yuc3R5bGUuZGlzcGxheT0nZmxleCc7d2Quc3R5bGUudmlzaWJpbGl0eT0naGlkZGVuJztjb25zdCBzPW1oLnF1ZXJ5U2VsZWN0b3IoJ3NwYW4nKTtpZihpbmYpe2lmKG1pKW1pLnN0eWxlLmRpc3BsYXk9J25vbmUnO3MudGV4dENvbnRlbnQ9J+aPkOekuu+8mid9ZWxzZXtpZihtaSltaS5zdHlsZS5kaXNwbGF5PSdibG9jayc7cy50ZXh0Q29udGVudD0n6K2m5ZGK77yaJ31zZXRUaW1lb3V0KCgpPT57Y29uc3Qgcj13ZC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKSx4PSh3aW5kb3cuaW5uZXJXaWR0aC1yLndpZHRoKS8yLHk9KHdpbmRvdy5pbm5lckhlaWdodC1yLmhlaWdodCkvMjtPYmplY3QuYXNzaWduKHdkLnN0eWxlLHtsZWZ0OngrInB4Iix0b3A6eSsicHgiLHZpc2liaWxpdHk6J3Zpc2libGUnfSk7JCgnbW9kYWxPaycpLmZvY3VzKCl9LDApfTt3aW5kb3cuY2xvc2VXaW5Nb2RhbD0oKT0+e292LnN0eWxlLmRpc3BsYXk9J25vbmUnfTtjb25zdCB1dD0oKT0+e2NvbnN0IGU9bmV3IERhdGU7dGQudGV4dENvbnRlbnQ9ZS5nZXRIb3VycygpLnRvU3RyaW5nKCkucGFkU3RhcnQoMiwiMCIpKyI6IitlLmdldE1pbnV0ZXMoKS50b1N0cmluZygpLnBhZFN0YXJ0KDIsIjAiKX07YXN5bmMgZnVuY3Rpb24gcGwoKXtpZihpc1Ape3dpbkFsZXJ0KCLmraPlnKjliqrlipvop6PmnpDkuK3vvIzor7fnqI3lgJkuLi4iLCEwKTtyZXR1cm59Y29uc29sZS5sb2coIuato+WcqOWIhuaekFVybC4uLiIpO2NvbnN0IGU9dWkudmFsdWUudHJpbSgpLGw9ZS50b0xvd2VyQ2FzZSgpO2lmKCFlfHwhKGwuc3RhcnRzV2l0aCgiaHR0cDovLyIpfHxsLnN0YXJ0c1dpdGgoImh0dHBzOi8vIikpKXtjb25zb2xlLmVycm9yKCLop6PmnpDlpLHotKU6IOaXoOaViOeahFVSTOWcsOWdgCIpO3J0LnZhbHVlPSLop6PmnpDlpLHotKU6IOaXoOaViOeahFVSTOWcsOWdgCI7cmV0dXJufWlzUD0hMDtydC52YWx1ZT0i5q2j5Zyo5YiG5p6QVXJsLi4uIjtjaz0iIjt0cnl7Y29uc3Qgcj1hd2FpdCBmZXRjaCgnL3BhcnNlJyx7bWV0aG9kOidQT1NUJyxoZWFkZXJzOnsnQ29udGVudC1UeXBlJzonYXBwbGljYXRpb24vanNvbid9LGJvZHk6SlNPTi5zdHJpbmdpZnkoe3VybDplfSl9KSxkPWF3YWl0IHIuanNvbigpO2lmKCFyLm9rKXtjb25zb2xlLmVycm9yKCLop6PmnpDlpLHotKU6IOacquefpemUmeivryIpO3J0LnZhbHVlPWQuZXJyb3J8fCLop6PmnpDlpLHotKU6IOacquefpemUmeivryJ9ZWxzZXtjb25zdCBzPWQucmVzdWx0fHwiIix0PXMudG9Mb3dlckNhc2UoKTtpZih0LnN0YXJ0c1dpdGgoImh0dHA6Ly8iKXx8dC5zdGFydHNXaXRoKCJodHRwczovLyIpKXtjb25zb2xlLmxvZygi6Kej5p6Q5a6M5oiQIik7cnQudmFsdWU9cztpZihkLmNvb2tpZSljaz1kLmNvb2tpZX1lbHNle2NvbnNvbGUuZXJyb3Iocyk7cnQudmFsdWU9c319fWNhdGNoKG4pe2NvbnNvbGUuZXJyb3IoIuino+aekOWksei0pTog572R57uc6L+e5o6l5byC5bi4IixuKTtydC52YWx1ZT0i6Kej5p6Q5aSx6LSlOiDnvZHnu5zov57mjqXlvILluLgifWZpbmFsbHl7aXNQPSExfX1kYi5vbmNsaWNrPSgpPT57Y29uc3Qgdj1ydC52YWx1ZS50cmltKCksbD12LnRvTG93ZXJDYXNlKCk7aWYoIXYpe3dpbkFsZXJ0KCLor7flhYjngrnlh7vjgJDlvIDlp4vop6PmnpDjgJHmjInpkq7ojrflj5bkuIvovb3lnLDlnYAiLCExKTtyZXR1cm59aWYoIShsLnN0YXJ0c1dpdGgoImh0dHA6Ly8iKXx8bC5zdGFydHNXaXRoKCJodHRwczovLyIpKSl7d2luQWxlcnQoIuino+aekOe7k+aenOS4jeaYr+acieaViOeahOS4i+i9veWcsOWdgCIsITEpO3JldHVybn1sZXQgZj1jcnlwdG8ucmFuZG9tVVVJRCgpLnJlcGxhY2UoLy0vZywnJyk7dHJ5e2NvbnN0IHA9bmV3IFVSTFNlYXJjaFBhcmFtcyh2LnNwbGl0KCc/JylbMV0pO2NvbnN0IGZuPXAuZ2V0KCdmaWxlTmFtZScpfHxwLmdldCgnZm5hbWUnKTtpZihmbilmPWZufWNhdGNoKGUpe31sZXQgY21kPSdjdXJsIC1zTCAiJyt2KyciJztpZihjayYmY2sudHJpbSgpIT09IiIpe2NtZCs9JyAtSCAiQ29va2llOiAnK2NrKyciJ31jbWQrPScgLW8gIicrZisnIic7d2luQWxlcnQoY21kLCEwKX07Y2Iub25jbGljaz0oKT0+e2NvbnNvbGUubG9nKCLlt7LmuIXnqbrmiYDmnInlhoXlrrkiKTt1aS52YWx1ZT0iIjtydC52YWx1ZT0iIjtjaz0iIjt1aS5mb2N1cygpfTttYi5vbmNsaWNrPSgpPT57aWYod2luZG93LmlubmVyV2lkdGg+OTIwKWlmKGlzTSl7dGIuY2xhc3NMaXN0LnJlbW92ZSgiaGlkZGVuIik7T2JqZWN0LmFzc2lnbih3Yy5zdHlsZSx7d2lkdGg6b1MudysicHgiLGhlaWdodDpvUy5oKyJweCIsYm9yZGVyUmFkaXVzOiI4cHgiLHRvcDpvUC55KyJweCIsbGVmdDpvUC54KyJweCIsekluZGV4OiIyIn0pO2lzTT0hMX1lbHNle29QPXt4OndjLm9mZnNldExlZnQseTp3Yy5vZmZzZXRUb3B9O29TPXt3OndjLm9mZnNldFdpZHRoLGg6d2Mub2Zmc2V0SGVpZ2h0fTt0Yi5jbGFzc0xpc3QuYWRkKCJoaWRkZW4iKTtPYmplY3QuYXNzaWduKHdjLnN0eWxlLHt3aWR0aDoiMTAwdnciLGhlaWdodDoiMTAwdmgiLGJvcmRlclJhZGl1czoiMCIsdG9wOiIwIixsZWZ0OiIwIixwb3NpdGlvbjoiZml4ZWQiLHpJbmRleDoiMyJ9KTtpc009ITB9fTtjb25zdCBzZD0oZSk9PntpZighaXNNJiZ3aW5kb3cuaW5uZXJXaWR0aD45MjApe2lzRD0hMDtkWD1lLmNsaWVudFg7ZFk9ZS5jbGllbnRZO2NvbnN0IG89d2MuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7Y1g9by5sZWZ0O2NZPW8udG9wO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIm1vdXNlbW92ZSIsZGQpO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIm1vdXNldXAiLHN0ZCl9fTtjb25zdCBkZD0oZSk9PntpZihpc0Qpe3djLnN0eWxlLmxlZnQ9Y1grKGUuY2xpZW50WC1kWCkrInB4Ijt3Yy5zdHlsZS50b3A9Y1krKGUuY2xpZW50WS1kWSkrInB4In19O2NvbnN0IHN0ZD0oKT0+e2lzRD0hMTtkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCJtb3VzZW1vdmUiLGRkKTtkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCJtb3VzZXVwIixzdGQpfTtjb25zdCBzbWQ9KGUpPT57aXNNRD0hMDttRFg9ZS5jbGllbnRYO21EWT1lLmNsaWVudFk7Y29uc3Qgbz13ZC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTttQ1g9by5sZWZ0O21DWT1vLnRvcDtkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCJtb3VzZW1vdmUiLG1tZCk7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigibW91c2V1cCIsc3RtZCl9O2NvbnN0IG1tZD0oZSk9PntpZihpc01EKXt3ZC5zdHlsZS5sZWZ0PW1DWCsoZS5jbGllbnRYLW1EWCkrInB4Ijt3ZC5zdHlsZS50b3A9bUNZKyhlLmNsaWVudFktbURZKSsicHgifX07Y29uc3Qgc3RtZD0oKT0+e2lzTUQ9ITE7ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigibW91c2Vtb3ZlIixtbWQpO2RvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoIm1vdXNldXAiLHN0bWQpfTtjb25zdCBjdz0oKT0+e2lmKCFpc00mJndpbmRvdy5pbm5lcldpZHRoPjkyMCl7Y29uc3QgeD0od2luZG93LmlubmVyV2lkdGgtOTAwKS8yLHk9KHdpbmRvdy5pbm5lckhlaWdodC01NTApLzI7T2JqZWN0LmFzc2lnbih3Yy5zdHlsZSx7bGVmdDp4KyJweCIsdG9wOnkrInB4Iixwb3NpdGlvbjoiZml4ZWQifSk7b1A9e3gseX19fTt3aW5kb3cub25sb2FkPSgpPT57Y3coKTt1dCgpO3NldEludGVydmFsKHV0LDFlMyl9O3BiLm9uY2xpY2s9cGw7dWkub25mb2N1cz0oKT0+dWkucGFyZW50RWxlbWVudC5zdHlsZS5ib3JkZXJDb2xvcj0iIzAwNzhENCI7dWkub25ibHVyPSgpPT51aS5wYXJlbnRFbGVtZW50LnN0eWxlLmJvcmRlckNvbG9yPSIjRThFOEU4Ijt1aS5vbmtleXByZXNzPWU9PnsiRW50ZXIiPT09ZS5rZXkmJnBsKCl9O2NsYi5vbmNsaWNrPSgpPT57d2luZG93LmlubmVyV2lkdGg+OTIwJiZ3aW5kb3cuY2xvc2UoKX07ZG9jdW1lbnQucXVlcnlTZWxlY3RvcigiLnRpdGxlLWJhci1kcmFnIikub25tb3VzZWRvd249c2Q7bWgub25tb3VzZWRvd249c21kO2dpLm9uY2xpY2s9KCk9Pnt3aW5kb3cub3BlbigiaHR0cHM6Ly9naXRodWIuY29tLzA1NzQwNjgyL0xpbmtTaW1wbGlmaWVyIiwiX2JsYW5rIil9Ow==";
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>LinkSimplifier</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI','Microsoft YaHei',sans-serif}body{background-color:#0078D4;background-image:linear-gradient(45deg,rgba(255,255,255,.05)25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,.05)25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,.05)75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,.05)75%);background-size:40px 40px;background-position:0 0,0 20px,20px -20px,-20px 0;color:#333;min-height:100vh;display:flex;justify-content:center;align-items:center;position:relative;overflow:hidden}.desktop-wallpaper{position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#0078D4 0%,#1E4FA0 50%,#002050 100%);z-index:-2}.taskbar{position:fixed;bottom:0;left:0;width:100%;height:48px;background-color:rgba(32,32,32,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:space-between;padding:0 10px;z-index:1000;border-top:1px solid rgba(255,255,255,.1);transition:opacity .3s ease}.taskbar.hidden{opacity:0;pointer-events:none}.windows-logo{width:24px;height:24px}.time-display{color:#fff;font-size:12px;padding:8px 12px}.window-container{width:900px;height:550px;background-color:#fafafa;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.15);display:flex;flex-direction:column;border:1px solid #e1e1e1;position:absolute;z-index:2}.title-bar{height:32px;background-color:#f3f3f3;display:flex;align-items:center;justify-content:space-between;padding:0 8px;user-select:none;border-bottom:1px solid #e1e1e1;-webkit-app-region:drag}.title-bar-drag{-webkit-app-region:drag;flex:1;height:100%;display:flex;align-items:center;padding-left:12px}.window-title{font-size:12px;font-weight:500;color:#333}.window-controls{display:flex;gap:2px;-webkit-app-region:no-drag}.window-btn{width:46px;height:32px;border:none;background:transparent;color:#333;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color .2s}.window-btn:hover{background-color:rgba(0,0,0,.08)}.window-btn.close:hover{background-color:#e81123;color:#fff}.window-btn.disabled{opacity:.3;cursor:default}.window-btn.disabled:hover{background-color:transparent}.window-btn svg{width:10px;height:10px}.window-content{flex:1;padding:16px;display:flex;flex-direction:column;overflow:hidden}.card{background-color:#fff;border:1px solid #e8e8e8;border-radius:6px;padding:16px;margin-bottom:16px}.input-section{display:flex;gap:8px;align-items:stretch}.input-container{flex:1;border:1px solid #e8e8e8;border-radius:6px;background-color:#fff;overflow:hidden;position:relative}.input-box{width:100%;height:44px;padding:12px;font-size:15px;border:none;outline:none;background-color:transparent}.placeholder{position:absolute;top:0;left:0;padding:12px;font-size:15px;color:#aaa;font-style:italic;pointer-events:none;display:flex;align-items:center;height:44px}.input-box:focus+.placeholder,.input-box:not(:placeholder-shown)+.placeholder{display:none}.btn{height:44px;font-size:15px;font-weight:600;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;transition:background-color .2s;display:flex;align-items:center;justify-content:center;min-width:80px}.btn-primary{background-color:#0078D4;color:#fff;min-width:100px}.btn-primary:hover{background-color:#006CBE}.btn-primary:active{background-color:#005A9E}.btn-primary:disabled{background-color:#ccc;color:#888;cursor:not-allowed}.btn-small{min-width:80px}.result-section{flex:1;display:flex;flex-direction:column}.result-box{flex:1;padding:12px;font-size:15px;border:none;outline:none;resize:none;background-color:transparent;font-family:'Segoe UI','Microsoft YaHei',monospace;line-height:1.5}.result-box:focus{outline:none}.desktop-icon{position:fixed;left:20px;top:20px;width:80px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .2s ease;z-index:1;text-align:center;background-color:transparent}.desktop-icon:hover{background-color:rgba(255,255,255,.1);border-radius:4px}.desktop-icon:active{transform:scale(.95)}.desktop-icon-img{width:48px;height:48px;margin-bottom:8px;background-color:transparent}.desktop-icon-text{color:#fff;font-size:12px;text-shadow:0 1px 3px rgba(0,0,0,.5);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.desktop-icon svg{background-color:transparent}.desktop-icon svg path{fill:#000!important}@media(max-width:920px){.desktop-wallpaper,.taskbar,.desktop-icon{display:none}.window-container{width:100vw;height:100vh;border-radius:0;box-shadow:none;border:none;position:fixed;top:0;left:0;margin:0;z-index:999}.title-bar{height:48px;background-color:#f3f3f3;color:#333;display:flex;position:relative;z-index:100}.title-bar-drag{display:flex;flex:1;padding-left:16px}.window-title{color:#333;font-size:16px;font-weight:500}.window-controls{display:flex;gap:2px;position:absolute;right:0;top:0;height:48px}.window-btn{width:48px;height:48px;color:#333}.window-btn.maximize{opacity:.3;cursor:default}.window-btn.maximize:hover{background-color:transparent}.window-btn.close:hover{background-color:#e81123;color:#fff}.window-content{padding:12px;padding-top:20px}.card{padding:12px;margin-bottom:12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.input-section{flex-direction:column;gap:8px}.input-box,.placeholder{height:46px;font-size:16px;padding:12px}.btn{height:46px;font-size:16px;width:100%}.btn-primary,.btn-small{min-width:100%;margin-top:4px}.result-section{height:calc(100vh - 210px)}.result-box{font-size:16px;padding:12px;min-height:200px}}#modalOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.2);display:none;justify-content:center;align-items:center;z-index:5000}.win-dialog{min-width:300px;max-width:650px;width:auto;background:#fff;border:1px solid #ccc;box-shadow:0 8px 20px rgba(0,0,0,0.2);display:flex;flex-direction:column;animation:winPop 0.1s ease-out;position:absolute;margin:0}@keyframes winPop{from{transform:scale(0.95);opacity:0}to{transform:scale(1);opacity:1}}.win-dialog-title{height:30px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding-left:10px;font-size:12px;color:#000;cursor:default}.win-dialog-close{width:46px;height:30px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:#333;transition:background-color .2s}.win-dialog-close:hover{background-color:#e81123;color:#fff}.win-dialog-content{padding:20px 25px;display:flex;gap:15px;align-items:flex-start}.win-icon{width:34px;height:34px;flex-shrink:0}.win-msg{font-size:14px;line-height:1.5;color:#000;white-space:pre-wrap;word-break:break-all;padding-top:2px;flex:1}.win-dialog-footer{padding:12px;background:#f0f0f0;display:flex;justify-content:flex-end}.win-dialog-btn{min-width:90px;height:26px;border:1px solid #8e8e8e;background:#e1e1e1;font-size:13px;cursor:pointer;outline:none}.win-dialog-btn:hover{background:#d0d0d0;border-color:#666}.win-dialog-btn:focus{border:2px solid #0078D4}
</style>
</head>
<body>
<div class="desktop-wallpaper"></div>
<div class="desktop-icon" id="githubIcon" title="项目仓库"><div class="desktop-icon-img"><svg viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg></div><div class="desktop-icon-text">项目仓库</div></div>
<div class="window-container" id="windowContainer">
<div class="title-bar"><div class="title-bar-drag"><div class="window-title">LinkSimplifier</div></div><div class="window-controls"><button class="window-btn minimize disabled" disabled><svg viewBox="0 0 10 1"><rect x="0" y="0" width="10" height="1" fill="currentColor"/></svg></button><button class="window-btn maximize" id="maximizeBtn"><svg viewBox="0 0 10 10"><rect x="0" y="0" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg></button><button class="window-btn close" id="closeBtn"><svg viewBox="0 0 10 10"><path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" stroke-width="1" fill="none"/></svg></button></div></div>
<div class="window-content"><div class="card"><div class="input-section"><div class="input-container"><input type="text" class="input-box" id="urlInput" placeholder=" "><div class="placeholder">请填写云盘分享链接...</div></div><button class="btn btn-primary" id="parseBtn">开始解析</button><button class="btn btn-primary" id="downloadBtn">下载文件</button><button class="btn btn-primary btn-small" id="clearBtn">清空</button></div></div><div class="card result-section"><textarea class="result-box" id="resultText" readonly></textarea></div></div>
</div>
<div class="taskbar" id="taskbar"><svg class="windows-logo" viewBox="0 0 4875 4875"><path fill="#0078d4" d="M0 0h2311v2310H0zm2564 0h2311v2310H2564zM0 2564h2311v2311H0zm2564 0h2311v2311H2564"/></svg><div class="time-display" id="timeDisplay">00:00</div></div>
<div id="modalOverlay">
    <div class="win-dialog" id="winDialog">
        <div class="win-dialog-title" id="modalHeader"><span>警告：</span><button class="win-dialog-close" onclick="closeWinModal()">✕</button></div>
        <div class="win-dialog-content">
            <svg class="win-icon" id="modalIcon" viewBox="0 0 32 32">
                <path d="M16 3 L30 28 L2 28 Z" fill="#ffcc00" stroke="#333" stroke-width="1"/>
                <path d="M15 12 h2 v8 h-2 Z M15 22 h2 v2 h-2 Z" fill="#333"/>
            </svg>
            <div class="win-msg" id="modalMsg"></div>
        </div>
        <div class="win-dialog-footer"><button class="win-dialog-btn" id="modalOk" onclick="closeWinModal()">确定</button></div>
    </div>
</div>
<script>
(function() {    try {      const b64 = "${encodedJS}";      const binStr = atob(b64);      const len = binStr.length;      const bytes = new Uint8Array(len);      for (let i = 0; i < len; i++) {        bytes[i] = binStr.charCodeAt(i);      }      const decoder = new TextDecoder('utf-8');      const scriptText = decoder.decode(bytes);      const scriptEl = document.createElement('script');      scriptEl.textContent = scriptText;      document.body.appendChild(scriptEl);    } catch (e) {      console.error("解码脚本失败:", e);    }  })();
</script>
</body>
</html>
`;
}