const DebugLogs = [];

const DebugLogger = {
  _getTimeStamp() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const cnTime = new Date(utc + 8 * 3600000);

    const Y = cnTime.getFullYear();
    const M = String(cnTime.getMonth() + 1).padStart(2, "0");
    const D = String(cnTime.getDate()).padStart(2, "0");
    const H = String(cnTime.getHours()).padStart(2, "0");
    const Min = String(cnTime.getMinutes()).padStart(2, "0");
    const S = String(cnTime.getSeconds()).padStart(2, "0");

    return `${Y}-${M}-${D} ${H}:${Min}:${S}`;
  },

  Write: (...args) => {
    const line = `[${DebugLogger._getTimeStamp()}][DEBUG] ${args.join(" ")}`;
    console.log(line);
    DebugLogs.push(line);
  },

  GetHeader: () => {
    const ts = DebugLogger._getTimeStamp();
    return [
      `[${ts}][DEBUG] Log system initialized.`,
      `[${ts}][DEBUG] === Start ===`,
      `[${ts}][DEBUG] ------------------------------------------------------------`,
      `[${ts}][DEBUG] LinkSimplifier for Cloudflare Workers & Pages`,
      `[${ts}][DEBUG] ------------------------------------------------------------`
    ];
  },

  GetFooter: () => {
    const ts = DebugLogger._getTimeStamp();
    return [
      `[${ts}][DEBUG] === End ===`
    ];
  },

  GetLogs: () => {
    const logs = [
      ...DebugLogger.GetHeader(),
      ...DebugLogs,
      ...DebugLogger.GetFooter()
    ];
    DebugLogs.length = 0;
    return logs;
  }
};

const RegexPatterns = {
  FolderParamRegex: /&folder/i,
  HttpProtocolRegex: /^https?:\/\//i,
  IframeSrcRegex: /<iframe[^>]*?src\s*=\s*["']?([^"'\s>]*)/i,
  PasswordParamRegex: /&pwd=(.*)/i,
  JavaScriptAjaxUrlRegex: /url\s*:\s*'([^']*)'/i,
  JavaScriptAjaxDataRegex: /data\s*:\s*\{([\s\S]*?)\}/i,
  JavaScriptCommentRegex:
    /(?:\/\/[^\r\n]*|\/\*[\s\S]*?\*\/)(?=([^"'`]*(?:"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`))*[^"'`]*$)/gm,
  JavaScriptVarRegex:
    /var\s+(\w+)\s*=\s*(\d+|'[^']+'|"[^"]+")\s*;/gi,
  JavaScriptAjaxDataKeyValueRegex:
    /'([^']+)'\s*:\s*('([^']*)'|"([^"]*)"|([^,\s}]+))/gi,
  AcwScV2ArgRegex: /var\s+arg1\s*=\s*'([^']+)'/i
};

const NetworkConfig = {
  DefaultAccept: "*/*",
  DefaultAcceptLanguage: "zh-CN,zh;q=0.9",
  DefaultUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36",
  Referer: "",
  Cookie: ""
};

const QQMail = {
  async GetDownloadLinkAsync(url) {
    try {
      const parsedUrl = new URL(url);
      NetworkConfig.Referer = parsedUrl.origin;

      const getFinalData = async (targetUrl) => {
        const res = await fetch(targetUrl, {
          method: "HEAD",
          headers: {
            "Accept": NetworkConfig.DefaultAccept,
            "Accept-Language": NetworkConfig.DefaultAcceptLanguage,
            "User-Agent": NetworkConfig.DefaultUserAgent,
            "Referer": NetworkConfig.Referer
          },
          redirect: "manual"
        });

        const rawCookie = res.headers.get("set-cookie") || "";
        const cookieMatch = rawCookie.match(/mail5k=[^;]+/);

        if (cookieMatch) {
          NetworkConfig.Cookie = cookieMatch[0];
          DebugLogger.Write("Cookie: ", NetworkConfig.Cookie);
        }

        const location = res.headers.get("location");
        return location || targetUrl;
      };

      const params = parsedUrl.searchParams;
      const key = params.get("key");
      const code = params.get("code");

      if (key && code) {
        const directUrl = `https://wx.mail.qq.com/ftn/download?func=4&key=${key}&code=${code}`;
        return await getFinalData(directUrl);
      }

      const timestamp = `${Math.floor(Math.random() * 1e13)}${Date.now()}`;
      const apiUrl = `${url}&r=${timestamp}&sid=`;

      const apiRes = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Accept": NetworkConfig.DefaultAccept,
          "Accept-Language": NetworkConfig.DefaultAcceptLanguage,
          "User-Agent": NetworkConfig.DefaultUserAgent,
          "Referer": NetworkConfig.Referer
        },
        body: "f=json"
      });

      const data = await apiRes.json();

      return await getFinalData(data.body.url);

    } catch (e) {
      return `解析失败: ${e.message}`;
    }
  }
};

const Lanzou = {
  calcAcwScV2(arg1) {
    const p = [
      15, 35, 29, 24, 33, 16, 1, 38, 10, 9, 19, 31, 40, 27, 22, 23,
      25, 13, 6, 11, 39, 18, 20, 8, 14, 21, 32, 26, 2, 30, 7, 4, 17, 5, 3, 28, 34, 37, 12, 36
    ];
    const m = "3000176000856006061501533003690027800375";
    const b = new Array(40);

    for (let i = 0; i < 40; i++)
      for (let j = 0; j < 40; j++)
        if (p[j] === i + 1) b[j] = arg1[i];

    let hex = "";
    for (let i = 0; i < 40; i += 2) {
      const v1 = parseInt(b.slice(i, i + 2).join(""), 16);
      const v2 = parseInt(m.substring(i, i + 2), 16);
      hex += (v1 ^ v2).toString(16).padStart(2, "0");
    }
    return hex;
  },

  async processAcwScV2Challenge(url) {
    DebugLogger.Write("开始处理acw_sc__v2挑战");

    const res = await fetch(url, {
      headers: {
        "Accept": NetworkConfig.DefaultAccept,
        "Accept-Language": NetworkConfig.DefaultAcceptLanguage,
        "User-Agent": NetworkConfig.DefaultUserAgent
      }
    })

    const html = await res.text();
    const match = html.match(RegexPatterns.AcwScV2ArgRegex);

    if (match) {
      DebugLogger.Write(`找到acw_sc__v2参数: ${match[1]}`);
      const cookieValue = this.calcAcwScV2(match[1]);
      DebugLogger.Write(`计算得到cookie值: ${cookieValue}`);
      NetworkConfig.Cookie = `acw_sc__v2=${cookieValue}`;
    }
    return;
  },

  extractAjaxData(cleanHtml, domain, password = null) {
    const vars = {};
    const varMatches = cleanHtml.matchAll(RegexPatterns.JavaScriptVarRegex);
    for (const m of varMatches) {
      const key = m[1];
      const val = m[2].replace(/^['"]|['"]$/g, "");
      if (!(key in vars)) {
        vars[key] = val;
      }
    }
    DebugLogger.Write(`提取到变量: ${Object.keys(vars).length} 个`);

    const ajaxMatch = cleanHtml.match(RegexPatterns.JavaScriptAjaxDataRegex);
    let ajaxData = ajaxMatch[1].replace(/\s+/g, " ").trim();
    DebugLogger.Write(`原始AJAX数据: ${ajaxData}`);

    const formData = {};
    const kvMatches = ajaxData.matchAll(RegexPatterns.JavaScriptAjaxDataKeyValueRegex);
    for (const m of kvMatches) {
      const key = m[1];
      const val = (m[3] || "") + (m[4] || "") + (m[5] || "");

      if (key.toLowerCase() === "pwd" || key.toLowerCase() === "p") {
        DebugLogger.Write(`${key}: 替换 pwd -> ******`);
        formData[key] = password ?? "";
        continue;
      }

      if (val in vars) {
        formData[key] = vars[val];
        DebugLogger.Write(`${key}: 替换 ${val} -> ${vars[val]}`);
      } else {
        formData[key] = val;
      }
    }

    const urlMatch = cleanHtml.match(RegexPatterns.JavaScriptAjaxUrlRegex);
    const postUrl = domain + urlMatch[1];
    DebugLogger.Write(`AJAX请求URL: ${postUrl}`);

    return { postUrl, formData };
  },

  async GetDownloadLinkAsync(url, password = null) {
    DebugLogger.Write(`开始获取下载链接: ${url}`);

    const domain = new URL(url).origin;
    DebugLogger.Write(`域名: ${domain}`);
    await this.processAcwScV2Challenge(url);

    const res = await fetch(url, {
      headers: {
        "Accept": NetworkConfig.DefaultAccept,
        "Accept-Language": NetworkConfig.DefaultAcceptLanguage,
        "User-Agent": NetworkConfig.DefaultUserAgent,
        "Cookie": NetworkConfig.Cookie
      }
    });

    let html = await res.text();
    NetworkConfig.Referer = url;

    if (!password) {
      DebugLogger.Write("无密码，检查 iframe");
      const iframeMatch = html.match(RegexPatterns.IframeSrcRegex);
      if (iframeMatch) {
        const iframeUrl = new URL(iframeMatch[1], domain)

        DebugLogger.Write(`找到 iframe , 跳转到: ${iframeUrl}`);
        NetworkConfig.Referer = iframeUrl;

        const iframeRes = await fetch(iframeUrl, {
          headers: {
            "Accept": NetworkConfig.DefaultAccept,
            "Accept-Language": NetworkConfig.DefaultAcceptLanguage,
            "User-Agent": NetworkConfig.DefaultUserAgent,
            "Cookie": NetworkConfig.Cookie
          }
        });

        html = await iframeRes.text();
      } else {
        return "解析失败：找不到 iframe , 请稍后重试";
      }
    }

    let cleanHtml = html.replace(RegexPatterns.JavaScriptCommentRegex, "");

    const { postUrl, formData } = Lanzou.extractAjaxData(cleanHtml, domain, password);
    const postBody = new URLSearchParams(formData);

    const ajaxRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Accept": NetworkConfig.DefaultAccept,
        "Accept-Language": NetworkConfig.DefaultAcceptLanguage,
        "User-Agent": NetworkConfig.DefaultUserAgent,
        "Referer": NetworkConfig.Referer,
        "Cookie": NetworkConfig.Cookie
      },
      body: postBody
    });

    const json = await ajaxRes.json();
    DebugLogger.Write(`收到JSON响应: ${JSON.stringify(json)}`);

    const resultCode = String(json.zt);
    DebugLogger.Write(`状态响应代码: ${resultCode}`);

    if (resultCode === "1") {

      const dom = json.dom;
      const url = json.url;

      const downloadPage = `${dom}/file/${url}`;
      DebugLogger.Write(`获取下载链接: ${downloadPage}`);

      const headRes = await fetch(downloadPage, {
        method: "HEAD",
        headers: {
          "Accept": NetworkConfig.DefaultAccept,
          "Accept-Language": NetworkConfig.DefaultAcceptLanguage,
          "User-Agent": NetworkConfig.DefaultUserAgent,
          "Referer": NetworkConfig.Referer,
          "Cookie": NetworkConfig.Cookie
        },
        redirect: "manual"
      });

      const finalUrl = headRes.headers.get("location");

      const decodedUrl = decodeURIComponent(finalUrl);
      DebugLogger.Write(`最终下载链接: ${decodedUrl}`);

      return decodedUrl;
    }
    else {
      return `解析失败: ${json.inf ?? json.info}`;
    }
  },

  async GetShareLinksFromFolder(url, password = null) {
    DebugLogger.Write(`开始获取文件夹分享链接: ${url}`);
    return "解析失败: 网页版暂不支持文件夹解析，请提供单文件链接";
  }
};

const UrlProcessor = {
  async ProcessUrlAsync(url) {

    if (!url || !RegexPatterns.HttpProtocolRegex.test(url)) {
      return "解析失败: 无效的URL地址";
    }

    try {
      const host = new URL(url).hostname.toLowerCase();

      if (host.includes("mail.qq")) {
        DebugLogger.Write("路由匹配: QQMail");
        return await this.ProcessQQMailUrlAsync(url);
      }

      if (host.includes("lanzou")) {
        DebugLogger.Write("路由匹配: LanZou");
        return await this.ProcessLanZouUrlAsync(url);
      }

      DebugLogger.Write("路由匹配: Default (Direct Link)");
      return url;
    } catch (e) {
      return `解析失败: ${e.message}`;
    }
  },

  async ProcessQQMailUrlAsync(url) {
    return await QQMail.GetDownloadLinkAsync(url);
  },

  async ProcessLanZouUrlAsync(url) {
    const { isFolder, password, baseUrl } = this.ExtractUrlParameters(url);
    DebugLogger.Write(`Folder: ${isFolder}`);
    return !isFolder ? await Lanzou.GetDownloadLinkAsync(baseUrl, password) : await Lanzou.GetShareLinksFromFolder(baseUrl, password);
  },

  ExtractUrlParameters(url) {
    const isFolder = RegexPatterns.FolderParamRegex.test(url);
    let baseUrl = isFolder ? url.replace(RegexPatterns.FolderParamRegex, "") : url;
    const password = baseUrl.match(RegexPatterns.PasswordParamRegex)?.[1] || "";
    baseUrl = baseUrl.replace(RegexPatterns.PasswordParamRegex, "");

    return { isFolder, password, baseUrl };
  }
};

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
          0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF,
          0x00, 0x00, 0x00, 0x21, 0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00, 0x00, 0x00,
          0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3B
        ]),
        { headers: { "Content-Type": "image/gif" } }
      );
    }

    if (path === "/parse") {
      if (request.method === "POST") {
        try {
          const { url } = await request.json();
          const result = await UrlProcessor.ProcessUrlAsync(url);

          const responseData = { result: result, cookie: NetworkConfig.Cookie || "", logs: DebugLogger.GetLogs() };

          NetworkConfig.Cookie = "";
          NetworkConfig.Referer = "";

          return new Response(JSON.stringify(responseData), { headers: { "Content-Type": "application/json;charset=UTF-8" } });
        } catch (e) {
          return new Response(JSON.stringify({ error: `解析失败: ${e.message}` }),
            { status: 400, headers: { "Content-Type": "application/json;charset=UTF-8" } });
        }
      }
      return new Response("Method Not Allowed", { status: 405 });
    }

    return new Response(renderHTML(), {
      headers: { "Content-Type": "text/html;charset=UTF-8" }
    });
  }
};

function renderHTML() {
  const encodedJS = "Y29uc3QgJD0oaSk9PmRvY3VtZW50LmdldEVsZW1lbnRCeUlkKGkpLHVpPSQoJ3VybElucHV0JykscGI9JCgncGFyc2VCdG4nKSxkYj0kKCdkb3dubG9hZEJ0bicpLGNiPSQoJ2NsZWFyQnRuJykscnQ9JCgncmVzdWx0VGV4dCcpLHdjPSQoJ3dpbmRvd0NvbnRhaW5lcicpLG1iPSQoJ21heGltaXplQnRuJyksY2xiPSQoJ2Nsb3NlQnRuJyksdGQ9JCgndGltZURpc3BsYXknKSx0Yj0kKCd0YXNrYmFyJyksZ2k9JCgnZ2l0aHViSWNvbicpLG92PSQoJ21vZGFsT3ZlcmxheScpLG1tPSQoJ21vZGFsTXNnJyksd2Q9JCgnd2luRGlhbG9nJyksbWg9JCgnbW9kYWxIZWFkZXInKSxtaT0kKCdtb2RhbEljb24nKTtsZXQgaXNNPSExLG9QPXt4OjAseTowfSxvUz17dzo5MDAsaDo1NTB9LGlzRD0hMSxkWCxkWSxjWCxjWSxjaz0iIixpc01EPSExLG1EWCxtRFksbUNYLG1DWSxpc1A9ITEsZHJhZ1RhcmdldD1udWxsO2NvbnN0IHdpbkFsZXJ0PShtLGluZj0hMSk9PnttbS50ZXh0Q29udGVudD1tO292LnN0eWxlLmRpc3BsYXk9J2ZsZXgnO3dkLnN0eWxlLnZpc2liaWxpdHk9J2hpZGRlbic7Y29uc3Qgcz1taC5xdWVyeVNlbGVjdG9yKCdzcGFuJyk7aWYoaW5mKXtpZihtaSltaS5zdHlsZS5kaXNwbGF5PSdub25lJztzLnRleHRDb250ZW50PSfmj5DnpLrvvJonfWVsc2V7aWYobWkpbWkuc3R5bGUuZGlzcGxheT0nYmxvY2snO3MudGV4dENvbnRlbnQ9J+itpuWRiu+8mid9c2V0VGltZW91dCgoKT0+e2NvbnN0IHI9d2QuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCkseD0od2luZG93LmlubmVyV2lkdGgtci53aWR0aCkvMix5PSh3aW5kb3cuaW5uZXJIZWlnaHQtci5oZWlnaHQpLzI7T2JqZWN0LmFzc2lnbih3ZC5zdHlsZSx7bGVmdDp4KyJweCIsdG9wOnkrInB4Iix2aXNpYmlsaXR5Oid2aXNpYmxlJ30pOyQoJ21vZGFsT2snKS5mb2N1cygpfSwwKX07d2luZG93LmNsb3NlV2luTW9kYWw9KCk9Pntvdi5zdHlsZS5kaXNwbGF5PSdub25lJ307Y29uc3QgdXQ9KCk9Pntjb25zdCBlPW5ldyBEYXRlO3RkLnRleHRDb250ZW50PWUuZ2V0SG91cnMoKS50b1N0cmluZygpLnBhZFN0YXJ0KDIsIjAiKSsiOiIrZS5nZXRNaW51dGVzKCkudG9TdHJpbmcoKS5wYWRTdGFydCgyLCIwIil9O2FzeW5jIGZ1bmN0aW9uIHBsKCl7aWYoaXNQKXt3aW5BbGVydCgi5q2j5Zyo5Yqq5Yqb6Kej5p6Q5Lit77yM6K+356iN5YCZLi4uIiwhMCk7cmV0dXJufWNvbnNvbGUubG9nKCLmraPlnKjliIbmnpBVcmwuLi4iKTtjb25zdCBlPXVpLnZhbHVlLnRyaW0oKSxsPWUudG9Mb3dlckNhc2UoKTtpZighZXx8IShsLnN0YXJ0c1dpdGgoImh0dHA6Ly8iKXx8bC5zdGFydHNXaXRoKCJodHRwczovLyIpKSl7Y29uc29sZS5lcnJvcigi6Kej5p6Q5aSx6LSlOiDml6DmlYjnmoRVUkzlnLDlnYAiKTtydC52YWx1ZT0i6Kej5p6Q5aSx6LSlOiDml6DmlYjnmoRVUkzlnLDlnYAiO3JldHVybn1pc1A9ITA7cnQudmFsdWU9Iuato+WcqOWIhuaekFVybC4uLiI7Y2s9IiI7dHJ5e2NvbnN0IHI9YXdhaXQgZmV0Y2goJy9wYXJzZScse21ldGhvZDonUE9TVCcsaGVhZGVyczp7J0NvbnRlbnQtVHlwZSc6J2FwcGxpY2F0aW9uL2pzb24nfSxib2R5OkpTT04uc3RyaW5naWZ5KHt1cmw6ZX0pfSksZD1hd2FpdCByLmpzb24oKTtpZighci5vayl7Y29uc3QgbT1kPy5lcnJvcj8/Iuino+aekOWksei0pTog5pyq55+l6ZSZ6K+vIjtjb25zb2xlLmVycm9yKG0pO3J0LnZhbHVlPW19ZWxzZXtjb25zdCBzPWQucmVzdWx0fHwiIix0PXMudG9Mb3dlckNhc2UoKTtpZih0LnN0YXJ0c1dpdGgoImh0dHA6Ly8iKXx8dC5zdGFydHNXaXRoKCJodHRwczovLyIpKXtjb25zb2xlLmxvZygi6Kej5p6Q5a6M5oiQIik7cnQudmFsdWU9cztpZihkLmNvb2tpZSljaz1kLmNvb2tpZTtpZih3aW5kb3cuc2V0UGFyc2VMb2dzJiZBcnJheS5pc0FycmF5KGQubG9ncykpd2luZG93LnNldFBhcnNlTG9ncyhkLmxvZ3MpfWVsc2V7Y29uc29sZS5lcnJvcihzKTtydC52YWx1ZT1zO2lmKHdpbmRvdy5zZXRQYXJzZUxvZ3MmJkFycmF5LmlzQXJyYXkoZC5sb2dzKSl3aW5kb3cuc2V0UGFyc2VMb2dzKGQubG9ncyl9fX1jYXRjaChuKXtjb25zb2xlLmVycm9yKCLop6PmnpDlpLHotKXvvJovcGFyc2Ug5o6l5Y+j5peg5ZON5bqUIixuKTtydC52YWx1ZT0i6Kej5p6Q5aSx6LSl77yaL3BhcnNlIOaOpeWPo+aXoOWTjeW6lCJ9ZmluYWxseXtpc1A9ITF9fWRiLm9uY2xpY2s9KCk9Pntjb25zdCB2PXJ0LnZhbHVlLnRyaW0oKSxsPXYudG9Mb3dlckNhc2UoKTtpZighdil7d2luQWxlcnQoIuivt+WFiOeCueWHu+OAkOW8gOWni+ino+aekOOAkeaMiemSruiOt+WPluS4i+i9veWcsOWdgCIsITEpO3JldHVybn1pZighKGwuc3RhcnRzV2l0aCgiaHR0cDovLyIpfHxsLnN0YXJ0c1dpdGgoImh0dHBzOi8vIikpKXt3aW5BbGVydCgi6Kej5p6Q57uT5p6c5LiN5piv5pyJ5pWI55qE5LiL6L295Zyw5Z2AIiwhMSk7cmV0dXJufWxldCBmPWNyeXB0by5yYW5kb21VVUlEKCkucmVwbGFjZSgvLS9nLCcnKTt0cnl7Y29uc3QgcD1uZXcgVVJMU2VhcmNoUGFyYW1zKHYuc3BsaXQoJz8nKVsxXSk7Y29uc3QgZm49cC5nZXQoJ2ZpbGVOYW1lJyl8fHAuZ2V0KCdmbmFtZScpO2lmKGZuKWY9Zm59Y2F0Y2goZSl7fWxldCBjbWQ9J2N1cmwgLXNMICInK3YrJyInO2lmKGNrJiZjay50cmltKCkhPT0iIil7Y21kKz0nIC1IICJDb29raWU6ICcrY2srJyInfWNtZCs9JyAtbyAiJytmKyciJzt3aW5BbGVydChjbWQsITApfTtjYi5vbmNsaWNrPSgpPT57Y29uc29sZS5sb2coIuW3sua4heepuuaJgOacieWGheWuuSIpO3VpLnZhbHVlPSIiO3J0LnZhbHVlPSIiO2NrPSIiO3VpLmZvY3VzKCl9O21iLm9uY2xpY2s9KCk9PntpZih3aW5kb3cuaW5uZXJXaWR0aD45MjApaWYoaXNNKXt0Yi5jbGFzc0xpc3QucmVtb3ZlKCJoaWRkZW4iKTtPYmplY3QuYXNzaWduKHdjLnN0eWxlLHt3aWR0aDpvUy53KyJweCIsaGVpZ2h0Om9TLmgrInB4Iixib3JkZXJSYWRpdXM6IjhweCIsdG9wOm9QLnkrInB4IixsZWZ0Om9QLngrInB4Iix6SW5kZXg6IjIifSk7aXNNPSExfWVsc2V7b1A9e3g6d2Mub2Zmc2V0TGVmdCx5OndjLm9mZnNldFRvcH07b1M9e3c6d2Mub2Zmc2V0V2lkdGgsaDp3Yy5vZmZzZXRIZWlnaHR9O3RiLmNsYXNzTGlzdC5hZGQoImhpZGRlbiIpO09iamVjdC5hc3NpZ24od2Muc3R5bGUse3dpZHRoOiIxMDB2dyIsaGVpZ2h0OiIxMDB2aCIsYm9yZGVyUmFkaXVzOiIwIix0b3A6IjAiLGxlZnQ6IjAiLHBvc2l0aW9uOiJmaXhlZCIsekluZGV4OiIzIn0pO2lzTT0hMH19O2NvbnN0IHNkPShlKT0+e2lmKHdpbmRvdy5pbm5lcldpZHRoPD05MjApcmV0dXJuO2RyYWdUYXJnZXQ9ZS5jdXJyZW50VGFyZ2V0LmNsb3Nlc3QoJy53aW5kb3ctY29udGFpbmVyJyk7aWYoIWRyYWdUYXJnZXQpcmV0dXJuO2lzRD0hMDtkWD1lLmNsaWVudFg7ZFk9ZS5jbGllbnRZO2NvbnN0IG89ZHJhZ1RhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtjWD1vLmxlZnQ7Y1k9by50b3A7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigibW91c2Vtb3ZlIixkZCk7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigibW91c2V1cCIsc3RkKX07Y29uc3QgZGQ9KGUpPT57aWYoIWlzRHx8IWRyYWdUYXJnZXQpcmV0dXJuO2RyYWdUYXJnZXQuc3R5bGUubGVmdD1jWCsoZS5jbGllbnRYLWRYKSsicHgiO2RyYWdUYXJnZXQuc3R5bGUudG9wPWNZKyhlLmNsaWVudFktZFkpKyJweCJ9O2NvbnN0IHN0ZD0oKT0+e2lzRD0hMTtkcmFnVGFyZ2V0PW51bGw7ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigibW91c2Vtb3ZlIixkZCk7ZG9jdW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcigibW91c2V1cCIsc3RkKX07Y29uc3Qgc21kPShlKT0+e2lzTUQ9ITA7bURYPWUuY2xpZW50WDttRFk9ZS5jbGllbnRZO2NvbnN0IG89d2QuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7bUNYPW8ubGVmdDttQ1k9by50b3A7ZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcigibW91c2Vtb3ZlIixtbWQpO2RvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoIm1vdXNldXAiLHN0bWQpfTtjb25zdCBtbWQ9KGUpPT57aWYoaXNNRCl7d2Quc3R5bGUubGVmdD1tQ1grKGUuY2xpZW50WC1tRFgpKyJweCI7d2Quc3R5bGUudG9wPW1DWSsoZS5jbGllbnRZLW1EWSkrInB4In19O2NvbnN0IHN0bWQ9KCk9Pntpc01EPSExO2RvY3VtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoIm1vdXNlbW92ZSIsbW1kKTtkb2N1bWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCJtb3VzZXVwIixzdG1kKX07Y29uc3QgY3c9KCk9PntpZighaXNNJiZ3aW5kb3cuaW5uZXJXaWR0aD45MjApe2NvbnN0IHg9KHdpbmRvdy5pbm5lcldpZHRoLTkwMCkvMix5PSh3aW5kb3cuaW5uZXJIZWlnaHQtNTUwKS8yO09iamVjdC5hc3NpZ24od2Muc3R5bGUse2xlZnQ6eCsicHgiLHRvcDp5KyJweCIscG9zaXRpb246ImZpeGVkIn0pO29QPXt4LHl9fX07d2luZG93Lm9ubG9hZD0oKT0+e2N3KCk7dXQoKTtzZXRJbnRlcnZhbCh1dCwxZTMpfTtwYi5vbmNsaWNrPXBsO3VpLm9uZm9jdXM9KCk9PnVpLnBhcmVudEVsZW1lbnQuc3R5bGUuYm9yZGVyQ29sb3I9IiMwMDc4RDQiO3VpLm9uYmx1cj0oKT0+dWkucGFyZW50RWxlbWVudC5zdHlsZS5ib3JkZXJDb2xvcj0iI0U4RThFOCI7dWkub25rZXlwcmVzcz1lPT57IkVudGVyIj09PWUua2V5JiZwbCgpfTtjbGIub25jbGljaz0oKT0+e3dpbmRvdy5pbm5lcldpZHRoPjkyMCYmd2luZG93LmNsb3NlKCl9O2RvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoIi50aXRsZS1iYXItZHJhZyIpLmZvckVhY2goZWw9PmVsLm9ubW91c2Vkb3duPXNkKTttaC5vbm1vdXNlZG93bj1zbWQ7Z2kub25jbGljaz0oKT0+e3dpbmRvdy5vcGVuKCJodHRwczovL2dpdGh1Yi5jb20vMDU3NDA2ODIvTGlua1NpbXBsaWZpZXIiLCJfYmxhbmsiKX07Y29uc3QgbG9nSWNvbj0kKCdsb2dJY29uJyksbG9nV2luPSQoJ2xvZ1dpbmRvdycpLGxvZ0Nsb3NlPSQoJ2xvZ0Nsb3NlQnRuJyk7bG9nSWNvbi5vbmNsaWNrPSgpPT57bG9nV2luLnN0eWxlLmRpc3BsYXk9J2ZsZXgnO2xvZ1dpbi5zdHlsZS5sZWZ0PSh3aW5kb3cuaW5uZXJXaWR0aC03MjApLzIrJ3B4Jztsb2dXaW4uc3R5bGUudG9wPSh3aW5kb3cuaW5uZXJIZWlnaHQtNDIwKS8yKydweCd9O2xvZ0Nsb3NlLm9uY2xpY2s9KCk9Pntsb2dXaW4uc3R5bGUuZGlzcGxheT0nbm9uZSd9O3dpbmRvdy5zZXRQYXJzZUxvZ3M9ZnVuY3Rpb24obG9ncyl7Y29uc3QgYm94PSQoJ2xvZ1ZpZXdlcicpO2JveC52YWx1ZT1BcnJheS5pc0FycmF5KGxvZ3MpP2xvZ3Muam9pbignXG4nKTon77yI5peg5pel5b+X77yJJztib3guc2Nyb2xsVG9wPWJveC5zY3JvbGxIZWlnaHR9Ow==";
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>LinkSimplifier</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI','Microsoft YaHei',sans-serif}body{background-color:#0078D4;background-image:linear-gradient(45deg,rgba(255,255,255,.05)25%,transparent 25%),linear-gradient(-45deg,rgba(255,255,255,.05)25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(255,255,255,.05)75%),linear-gradient(-45deg,transparent 75%,rgba(255,255,255,.05)75%);background-size:40px 40px;background-position:0 0,0 20px,20px -20px,-20px 0;color:#333;min-height:100vh;display:flex;justify-content:center;align-items:center;position:relative;overflow:hidden}.desktop-wallpaper{position:fixed;top:0;left:0;width:100%;height:100%;background:linear-gradient(135deg,#0078D4 0%,#1E4FA0 50%,#002050 100%);z-index:-2}.taskbar{position:fixed;bottom:0;left:0;width:100%;height:48px;background-color:rgba(32,32,32,.9);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:space-between;padding:0 10px;z-index:1000;border-top:1px solid rgba(255,255,255,.1);transition:opacity .3s ease}.taskbar.hidden{opacity:0;pointer-events:none}.windows-logo{width:24px;height:24px}.time-display{color:#fff;font-size:12px;padding:8px 12px}.window-container{width:900px;height:550px;background-color:#fafafa;border-radius:8px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.15);display:flex;flex-direction:column;border:1px solid #e1e1e1;position:absolute;z-index:2}.title-bar{height:32px;background-color:#f3f3f3;display:flex;align-items:center;justify-content:space-between;padding:0 8px;user-select:none;border-bottom:1px solid #e1e1e1;-webkit-app-region:drag}.title-bar-drag{-webkit-app-region:drag;flex:1;height:100%;display:flex;align-items:center;padding-left:12px}.window-title{font-size:12px;font-weight:500;color:#333}.window-controls{display:flex;gap:2px;-webkit-app-region:no-drag}.window-btn{width:46px;height:32px;border:none;background:transparent;color:#333;font-size:10px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background-color .2s}.window-btn:hover{background-color:rgba(0,0,0,.08)}.window-btn.close:hover{background-color:#e81123;color:#fff}.window-btn.disabled{opacity:.3;cursor:default}.window-btn.disabled:hover{background-color:transparent}.window-btn svg{width:10px;height:10px}.window-content{flex:1;padding:16px;display:flex;flex-direction:column;overflow:hidden}.card{background-color:#fff;border:1px solid #e8e8e8;border-radius:6px;padding:16px;margin-bottom:16px}.input-section{display:flex;gap:8px;align-items:stretch}.input-container{flex:1;border:1px solid #e8e8e8;border-radius:6px;background-color:#fff;overflow:hidden;position:relative}.input-box{width:100%;height:44px;padding:12px;font-size:15px;border:none;outline:none;background-color:transparent}.placeholder{position:absolute;top:0;left:0;padding:12px;font-size:15px;color:#aaa;font-style:italic;pointer-events:none;display:flex;align-items:center;height:44px}.input-box:focus+.placeholder,.input-box:not(:placeholder-shown)+.placeholder{display:none}.btn{height:44px;font-size:15px;font-weight:600;padding:8px 16px;border:none;border-radius:6px;cursor:pointer;transition:background-color .2s;display:flex;align-items:center;justify-content:center;min-width:80px}.btn-primary{background-color:#0078D4;color:#fff;min-width:100px}.btn-primary:hover{background-color:#006CBE}.btn-primary:active{background-color:#005A9E}.btn-primary:disabled{background-color:#ccc;color:#888;cursor:not-allowed}.btn-small{min-width:80px}.result-section{flex:1;display:flex;flex-direction:column}.result-box{flex:1;padding:12px;font-size:15px;border:none;outline:none;resize:none;background-color:transparent;font-family:'Segoe UI','Microsoft YaHei',monospace;line-height:1.5}.result-box:focus{outline:none}.desktop-icon{position:fixed;left:20px;top:20px;width:80px;height:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:all .2s ease;z-index:1;text-align:center;background-color:transparent}.desktop-icon:hover{background-color:rgba(255,255,255,.1);border-radius:4px}.desktop-icon:active{transform:scale(.95)}.desktop-icon-img{width:48px;height:48px;margin-bottom:8px;background-color:transparent}.desktop-icon-text{color:#fff;font-size:12px;text-shadow:0 1px 3px rgba(0,0,0,.5);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.desktop-icon svg{background-color:transparent}.desktop-icon svg path{fill:#000!important}@media(max-width:920px){.desktop-wallpaper,.taskbar,.desktop-icon{display:none}.window-container{width:100vw;height:100vh;border-radius:0;box-shadow:none;border:none;position:fixed;top:0;left:0;margin:0;z-index:999}.title-bar{height:48px;background-color:#f3f3f3;color:#333;display:flex;position:relative;z-index:100}.title-bar-drag{display:flex;flex:1;padding-left:16px}.window-title{color:#333;font-size:16px;font-weight:500}.window-controls{display:flex;gap:2px;position:absolute;right:0;top:0;height:48px}.window-btn{width:48px;height:48px;color:#333}.window-btn.maximize{opacity:.3;cursor:default}.window-btn.maximize:hover{background-color:transparent}.window-btn.close:hover{background-color:#e81123;color:#fff}.window-content{padding:12px;padding-top:20px}.card{padding:12px;margin-bottom:12px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}.input-section{flex-direction:column;gap:8px}.input-box,.placeholder{height:46px;font-size:16px;padding:12px}.btn{height:46px;font-size:16px;width:100%}.btn-primary,.btn-small{min-width:100%;margin-top:4px}.result-section{height:calc(100vh - 210px)}.result-box{font-size:16px;padding:12px;min-height:200px}}#modalOverlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.2);display:none;justify-content:center;align-items:center;z-index:5000}.win-dialog{min-width:300px;max-width:650px;width:auto;background:#fff;border:1px solid #ccc;box-shadow:0 8px 20px rgba(0,0,0,0.2);display:flex;flex-direction:column;animation:winPop 0.1s ease-out;position:absolute;margin:0}@keyframes winPop{from{transform:scale(0.95);opacity:0}to{transform:scale(1);opacity:1}}.win-dialog-title{height:30px;background:#fff;display:flex;align-items:center;justify-content:space-between;padding-left:10px;font-size:12px;color:#000;cursor:default}.win-dialog-close{width:46px;height:30px;border:none;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:10px;color:#333;transition:background-color .2s}.win-dialog-close:hover{background-color:#e81123;color:#fff}.win-dialog-content{padding:20px 25px;display:flex;gap:15px;align-items:flex-start}.win-icon{width:34px;height:34px;flex-shrink:0}.win-msg{font-size:14px;line-height:1.5;color:#000;white-space:pre-wrap;word-break:break-all;padding-top:2px;flex:1}.win-dialog-footer{padding:12px;background:#f0f0f0;display:flex;justify-content:flex-end}.win-dialog-btn{min-width:90px;height:26px;border:1px solid #8e8e8e;background:#e1e1e1;font-size:13px;cursor:pointer;outline:none}.win-dialog-btn:hover{background:#d0d0d0;border-color:#666}.win-dialog-btn:focus{border:2px solid #0078D4}#logViewer:focus{outline:none;}
</style>
</head>
<body>
<div class="desktop-wallpaper"></div>
<div class="desktop-icon" id="githubIcon" title="项目仓库"><div class="desktop-icon-img"><svg viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg></div><div class="desktop-icon-text">项目仓库</div></div>
<div class="desktop-icon" id="logIcon" title="Log" style="top:130px"><svg class="desktop-icon-img" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2" fill="#fff" stroke="#555" stroke-width="1.2"/><path d="M8 7h8M8 10.5h6M8 14h4" stroke="#0078D4" stroke-width="1.5"/></svg><div class="desktop-icon-text">Log</div></div>
<div class="window-container" id="windowContainer">
<div class="title-bar"><div class="title-bar-drag"><div class="window-title">LinkSimplifier</div></div><div class="window-controls"><button class="window-btn minimize disabled" disabled><svg viewBox="0 0 10 1"><rect x="0" y="0" width="10" height="1" fill="currentColor"/></svg></button><button class="window-btn maximize" id="maximizeBtn"><svg viewBox="0 0 10 10"><rect x="0" y="0" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/></svg></button><button class="window-btn close" id="closeBtn"><svg viewBox="0 0 10 10"><path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" stroke-width="1" fill="none"/></svg></button></div></div>
<div class="window-content"><div class="card"><div class="input-section"><div class="input-container"><input type="text" class="input-box" id="urlInput" placeholder=" "><div class="placeholder">请填写云盘分享链接...</div></div><button class="btn btn-primary" id="parseBtn">开始解析</button><button class="btn btn-primary" id="downloadBtn">下载文件</button><button class="btn btn-primary btn-small" id="clearBtn">清空</button></div></div><div class="card result-section"><textarea class="result-box" id="resultText" readonly></textarea></div></div>
</div>
<div class="window-container" id="logWindow" style="display:none;width:720px;height:420px;position:absolute;z-index:10"><div class="title-bar"><div class="title-bar-drag"><div class="window-title">Log</div></div><div class="window-controls"><button class="window-btn close" id="logCloseBtn"><svg viewBox="0 0 10 10"><path d="M1,1 L9,9 M9,1 L1,9" stroke="currentColor" stroke-width="1" fill="none"/></svg></button></div></div><div class="window-content" style="padding:8px"><textarea id="logViewer" readonly style="width:100%;height:100%;background:#111;color:#0f0;font-family:Consolas,monospace;font-size:13px;padding:10px;border:none;resize:none;border-radius:4px">暂无日志</textarea></div></div>
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