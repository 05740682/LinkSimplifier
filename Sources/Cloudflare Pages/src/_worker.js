const CreateContext = () => ({
  DebugLogs: [],
  NetworkConfig: {
    DefaultAccept: "*/*",
    DefaultAcceptLanguage: "zh-CN,zh;q=0.9",
    DefaultUserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
    Referer: "",
    Cookie: ""
  }
});
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

  Write: (ctx, ...args) => {
    const line = `[${DebugLogger._getTimeStamp()}][DEBUG] ${args.join(" ")}`;

    console.log(line);

    ctx.DebugLogs.push(line);
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

  GetLogs: (ctx) => {
    return [
      ...DebugLogger.GetHeader(),
      ...ctx.DebugLogs,
      ...DebugLogger.GetFooter()
    ];
  }
};
const RegexPatterns = {
  FolderParamRegex: /&folder/i,
  HttpProtocolRegex: /^https?:\/\//i,
  IframeSrcRegex: /<iframe[^>]*?src\s*=\s*["']?([^"'\s>]*)/i,
  PasswordParamRegex: /&pwd=(.*)/i,
  JavaScriptAjaxUrlRegex: /[^']*?\.php\?file=\d+/i,
  JavaScriptAjaxDataRegex: /data\s*:\s*\{([\s\S]*?)\}/i,
  JavaScriptCommentRegex: /(?<!:)\/\/[^\r\n]*|\/\*[\s\S]*?\*\//gm,
  JavaScriptVarRegex:
    /var\s+(\w+)\s*=\s*(\d+|'[^']+'|"[^"]+")\s*;/gi,
  JavaScriptAjaxDataKeyValueRegex:
    /'([^']+)'\s*:\s*('([^']*)'|"([^"]*)"|([^,\s}]+))/gi,
  AcwScV2ArgRegex: /var\s+arg1\s*=\s*'([^']+)'/i
};
const QQMail = {
  async GetDownloadLinkAsync(url, ctx) {
    try {
      const parsedUrl = new URL(url);

      ctx.NetworkConfig.Referer = parsedUrl.origin;

      const getFinalData = async (targetUrl) => {
        const res = await fetch(targetUrl, {
          method: "HEAD",
          headers: {
            "Accept": ctx.NetworkConfig.DefaultAccept,
            "Accept-Language": ctx.NetworkConfig.DefaultAcceptLanguage,
            "User-Agent": ctx.NetworkConfig.DefaultUserAgent,
            "Referer": ctx.NetworkConfig.Referer
          },
          redirect: "manual"
        });

        const rawCookie = res.headers.get("set-cookie") || "";

        const cookieMatch = rawCookie.match(/mail5k=[^;]+/);

        if (cookieMatch) {
          ctx.NetworkConfig.Cookie = cookieMatch[0];

          DebugLogger.Write(ctx, "Cookie: ", ctx.NetworkConfig.Cookie);
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
          "Accept": ctx.NetworkConfig.DefaultAccept,
          "Accept-Language": ctx.NetworkConfig.DefaultAcceptLanguage,
          "User-Agent": ctx.NetworkConfig.DefaultUserAgent,
          "Referer": ctx.NetworkConfig.Referer
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

  async processAcwScV2Challenge(url, ctx) {
    DebugLogger.Write(ctx, "开始处理acw_sc__v2挑战");

    const cookieMap = new Map();

    const loadCookie = () => {
      if (ctx.NetworkConfig.Cookie) {
        ctx.NetworkConfig.Cookie
          .split(";")
          .forEach(c => {
            const item = c.trim();
            const index = item.indexOf("=");

            if (index > 0) {
              cookieMap.set(
                item.substring(0, index).trim(),
                item.substring(index + 1).trim()
              );
            }
          });
      }
    };

    const saveCookie = headers => {
      let setCookies = [];

      if (typeof headers.getSetCookie === "function") {
        setCookies = headers.getSetCookie();
      } else {
        const rawCookie = headers.get("set-cookie");

        if (rawCookie) {
          setCookies = [rawCookie];
        }
      }

      setCookies = setCookies.flatMap(cookie =>
        cookie.split(/,(?=\s*[^;,=\s]+=[^;,=\s]+)/)
      );

      for (const cookie of setCookies) {
        const pair = cookie.split(";")[0].trim();
        const index = pair.indexOf("=");

        if (index > 0) {
          const key = pair.substring(0, index).trim();
          const value = pair.substring(index + 1).trim();

          cookieMap.set(key, value);
        }
      }

      ctx.NetworkConfig.Cookie =
        Array.from(cookieMap.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join("; ");
    };

    loadCookie();

    let res = await fetch(url, {
      headers: {
        "Accept": ctx.NetworkConfig.DefaultAccept,
        "Accept-Language": ctx.NetworkConfig.DefaultAcceptLanguage,
        "User-Agent": ctx.NetworkConfig.DefaultUserAgent,
        "Cookie": ctx.NetworkConfig.Cookie
      },
      	 redirect: "manual"
    });

    saveCookie(res.headers);

    let html = await res.text();

    const match = html.match(RegexPatterns.AcwScV2ArgRegex);

    if (match) {
      const cookieValue = this.calcAcwScV2(match[1]);

      cookieMap.set("acw_sc__v2", cookieValue);

      ctx.NetworkConfig.Cookie =
        Array.from(cookieMap.entries())
          .map(([k, v]) => `${k}=${v}`)
          .join("; ");

      res = await fetch(url, {
        headers: {
          "Accept": ctx.NetworkConfig.DefaultAccept,
          "Accept-Language": ctx.NetworkConfig.DefaultAcceptLanguage,
          "User-Agent": ctx.NetworkConfig.DefaultUserAgent,
          "Cookie": ctx.NetworkConfig.Cookie
        },
         redirect: "manual"
      });

      saveCookie(res.headers);

      html = await res.text();
    }
    return html;
  },
  
  extractAjaxData(cleanHtml, domain, password = null, ctx) {
    const vars = {};

    const varMatches = cleanHtml.matchAll(RegexPatterns.JavaScriptVarRegex);

    for (const m of varMatches) {
      const key = m[1];
      const val = m[2].replace(/^['"]|['"]$/g, "");

      if (!(key in vars)) {
        vars[key] = val;
      }
    }

    DebugLogger.Write(ctx, `提取到变量: ${Object.keys(vars).length} 个`);

    const ajaxMatch = cleanHtml.match(RegexPatterns.JavaScriptAjaxDataRegex);

    let ajaxData = ajaxMatch[1].replace(/\s+/g, " ").trim();

    DebugLogger.Write(ctx, `原始AJAX数据: ${ajaxData}`);

    const formData = {};

    const kvMatches = ajaxData.matchAll(RegexPatterns.JavaScriptAjaxDataKeyValueRegex);

    for (const m of kvMatches) {
      const key = m[1];

      const val =
        (m[3] || "") +
        (m[4] || "") +
        (m[5] || "");

      if (
        key.toLowerCase() === "pwd" ||
        key.toLowerCase() === "p"
      ) {
        DebugLogger.Write(ctx, `${key}: 替换 pwd -> ******`);

        formData[key] = password ?? "";

        continue;
      }

      if (val in vars) {
        formData[key] = vars[val];

        DebugLogger.Write(ctx, `${key}: 替换 ${val} -> ${vars[val]}`);
      } else {
        formData[key] = val;
      }
    }

    const urlMatch = cleanHtml.match(RegexPatterns.JavaScriptAjaxUrlRegex);
    const rawUrl = urlMatch[0];

    const postUrl = RegexPatterns.HttpProtocolRegex.test(rawUrl) ? rawUrl : domain + rawUrl;

    DebugLogger.Write(ctx, `AJAX请求URL: ${postUrl}`);

    return {
      postUrl,
      formData
    };
  },

  async GetDownloadLinkAsync(url, password = null, ctx) {
    DebugLogger.Write(ctx, `开始获取下载链接: ${url}`);

    const domain = new URL(url).origin;

    DebugLogger.Write(ctx, `域名: ${domain}`);

    let html =  await this.processAcwScV2Challenge(url, ctx);

    ctx.NetworkConfig.Referer = url;

    if (!password) {
      DebugLogger.Write(ctx, "无密码，检查 iframe");

      const iframeMatch = html.match(RegexPatterns.IframeSrcRegex);

      if (iframeMatch) {
        const iframeUrl = new URL(iframeMatch[1], domain);

        ctx.NetworkConfig.Referer = iframeUrl;

        DebugLogger.Write(ctx, `找到 iframe , 跳转到: ${iframeUrl}`);

       html = await this.processAcwScV2Challenge(iframeUrl, ctx);

      } else {
        return "解析失败：找不到 iframe , 请稍后重试";
      }
    }

    let cleanHtml = html.replace(RegexPatterns.JavaScriptCommentRegex, "");

    const { postUrl, formData } = Lanzou.extractAjaxData(cleanHtml, domain, password, ctx);

    const postBody = new URLSearchParams(formData);

    const ajaxRes = await fetch(postUrl, {
      method: "POST",
      headers: {
        "Accept": ctx.NetworkConfig.DefaultAccept,
        "Accept-Language": ctx.NetworkConfig.DefaultAcceptLanguage,
        "User-Agent": ctx.NetworkConfig.DefaultUserAgent,
        "Referer": ctx.NetworkConfig.Referer,
        "Cookie": ctx.NetworkConfig.Cookie
      },
      body: postBody
    });

    const json = await ajaxRes.json();

    DebugLogger.Write(ctx, `收到JSON响应: ${JSON.stringify(json)}`);

    const resultCode = String(json.zt);

    DebugLogger.Write(ctx, `状态响应代码: ${resultCode}`);

    if (resultCode === "1") {
      const dom = json.dom;
      const url = json.url;

      const downloadPage = `${dom}/file/${url}`;

      DebugLogger.Write(ctx, `获取下载链接: ${downloadPage}`);

      let headRes = await fetch(downloadPage, {
        method: "HEAD",
        headers: {
          "Accept": ctx.NetworkConfig.DefaultAccept,
          "Accept-Language": ctx.NetworkConfig.DefaultAcceptLanguage,
          "User-Agent": ctx.NetworkConfig.DefaultUserAgent,
          "Referer": ctx.NetworkConfig.Referer,
          "Cookie": ctx.NetworkConfig.Cookie
        },
        redirect: "manual"
      });

      let finalUrl = headRes.headers.get("location");

      if (!finalUrl) {
        await this.processAcwScV2Challenge(downloadPage, ctx);

        headRes = await fetch(downloadPage, {
          method: "HEAD",
          headers: {
            "Accept": ctx.NetworkConfig.DefaultAccept,
            "Accept-Language": ctx.NetworkConfig.DefaultAcceptLanguage,
            "User-Agent": ctx.NetworkConfig.DefaultUserAgent,
            "Referer": ctx.NetworkConfig.Referer,
            "Cookie": ctx.NetworkConfig.Cookie
          },
          redirect: "manual"
        });

        finalUrl = headRes.headers.get("location");
      }

      if (!finalUrl) {
        return "解析失败：无法获取最终下载直链";
      }

      const decodedUrl = decodeURIComponent(finalUrl);

      DebugLogger.Write(ctx, `最终下载链接: ${decodedUrl}`);

      return decodedUrl;

    } else {
      return `解析失败: ${json.inf ?? json.info}`;
    }
  },

  async GetShareLinksFromFolder(url, password = null, ctx) {
    DebugLogger.Write(ctx, `开始获取文件夹分享链接: ${url}`);
    return "解析失败: 网页版暂不支持文件夹解析，请提供单文件链接";
  }
};
const UrlProcessor = {
  async ProcessUrlAsync(url, ctx) {
    if (!url || !RegexPatterns.HttpProtocolRegex.test(url)) {
      return "解析失败: 无效的URL地址";
    }

    try {
      const host = new URL(url).hostname.toLowerCase();

      if (host.includes("mail.qq")) {
        DebugLogger.Write(ctx, "路由匹配: QQMail");
        return await this.ProcessQQMailUrlAsync(url, ctx);
      }

      if (host.includes("lanzou")) {
        DebugLogger.Write(ctx, "路由匹配: LanZou");
        return await this.ProcessLanZouUrlAsync(url, ctx);
      }

      DebugLogger.Write(ctx, "路由匹配: Default (Direct Link)");
      return url;

    } catch (e) {
      return `解析失败: ${e.message}`;
    }
  },

  async ProcessQQMailUrlAsync(url, ctx) {
    return await QQMail.GetDownloadLinkAsync(url, ctx);
  },

  async ProcessLanZouUrlAsync(url, ctx) {
    const { isFolder, password, baseUrl } = this.ExtractUrlParameters(url);

    DebugLogger.Write(ctx, `Folder: ${isFolder}`);

    return !isFolder
      ? await Lanzou.GetDownloadLinkAsync(baseUrl, password, ctx)
      : await Lanzou.GetShareLinksFromFolder(baseUrl, password, ctx);
  },

  ExtractUrlParameters(url) {
    const isFolder = RegexPatterns.FolderParamRegex.test(url);

    let baseUrl = isFolder
      ? url.replace(RegexPatterns.FolderParamRegex, "")
      : url;

    const password =
      baseUrl.match(RegexPatterns.PasswordParamRegex)?.[1] || "";

    baseUrl = baseUrl.replace(RegexPatterns.PasswordParamRegex, "");

    return {
      isFolder,
      password,
      baseUrl
    };
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
        const requestContext = CreateContext();

        try {
          const { url } = await request.json();
          const result = await UrlProcessor.ProcessUrlAsync(url, requestContext);

          const responseData = {
            result: result,
            cookie: requestContext.NetworkConfig.Cookie || "",
            logs: DebugLogger.GetLogs(requestContext)
          };

          return new Response(JSON.stringify(responseData), {
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: `解析失败: ${e.message}` }), {
            status: 400,
            headers: { "Content-Type": "application/json;charset=UTF-8" }
          });
        }
      }

      return new Response("Method Not Allowed", { status: 405 });
    }

    return env.src.fetch(request);
  }
};