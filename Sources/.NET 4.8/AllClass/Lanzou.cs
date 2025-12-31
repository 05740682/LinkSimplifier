using Microsoft.SqlServer.Server;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;

namespace LinkSimplifier
{
    internal class Lanzou
    {
        private static string CalculateAcwScV2(string arg1)
        {
            int[] p = { 15, 35, 29, 24, 33, 16, 1, 38, 10, 9, 19, 31, 40, 27, 22, 23, 25, 13, 6, 11, 39, 18, 20, 8, 14, 21, 32, 26, 2, 30, 7, 4, 17, 5, 3, 28, 34, 37, 12, 36 };
            string m = "3000176000856006061501533003690027800375";

            char[] b = new char[40];
            for (int i = 0; i < 40; i++)
                for (int j = 0; j < 40; j++)
                    if (p[j] == i + 1)
                        b[j] = arg1[i];

            StringBuilder sb = new StringBuilder(40);
            for (int i = 0; i < 40; i += 2)
            {
                int v1 = Convert.ToInt32(new string(b, i, 2), 16);
                int v2 = Convert.ToInt32(m.Substring(i, 2), 16);
                sb.Append((v1 ^ v2).ToString("X2"));
            }

            return sb.ToString().ToLower();
        }

        private static async Task ProcessAcwScV2Challenge(Uri domain, string url)
        {
            await DebugLogger.WriteLogAsync($"开始处理acw_sc__v2挑战: {url}");

            var html = await Downloader.DownloadStringAsync(url);

            var _m = Globals.AcwScV2ArgRegex.Match(html);
            if (_m.Success)
            {
                await DebugLogger.WriteLogAsync($"找到acw_sc__v2参数: {_m.Groups[1].Value}");
                var cookieValue = CalculateAcwScV2(_m.Groups[1].Value);
                await DebugLogger.WriteLogAsync($"计算得到cookie值: {cookieValue}");
                HttpClientWrapper.CookieContainer.Add(domain, new Cookie("acw_sc__v2", cookieValue));
            }
        }

        /// <summary>
        /// 从HTML提取AJAX数据（返回URL和表单数据）
        /// </summary>
        private static async Task<(string PostUrl, Dictionary<string, string> FormData)> ExtractAjaxDataAsync(string cleanHtml, string domain, string password = null)
        {
            var vars = new Dictionary<string, string>();
            Globals.JavaScriptVarRegex.Matches(cleanHtml).Cast<Match>().ToList().ForEach(m => vars[m.Groups[1].Value] = m.Groups[2].Success ? m.Groups[2].Value.Trim().Trim('\'') : "");
            Globals.JavaScriptAssignRegex.Matches(cleanHtml).Cast<Match>().Where(m => vars.ContainsKey(m.Groups[1].Value)).ToList().ForEach(m => vars[m.Groups[1].Value] = m.Groups[2].Value.Trim().Trim('\''));
            vars["pwd"] = password ?? "";

            await DebugLogger.WriteLogAsync($"提取到变量: {vars.Count} 个");

            var ajaxData = Regex.Replace(Globals.JavaScriptAjaxDataRegex.Match(cleanHtml).Groups[1].Value, @"\s+", " ").Trim();
            await DebugLogger.WriteLogAsync($"原始AJAX数据: {ajaxData}");

            var formData = ajaxData.Split(',').Select(p => p.Split(':')).Where(parts => parts.Length == 2).ToDictionary(parts => parts[0].Trim().Trim('\'', '"'), parts => parts[1].Trim().Trim('\'', '"'));
            await DebugLogger.WriteLogAsync($"构造表单数据: {formData.Count} 个字段");

            foreach (var key in formData.Keys.ToList())
                if (vars.TryGetValue(formData[key], out var newValue))
                    (formData[key], _) = (newValue, DebugLogger.WriteLogAsync($"{key}: 替换 {formData[key]} -> {newValue}"));

            var postUrl = domain + Globals.JavaScriptAjaxUrlRegex.Match(cleanHtml).Groups[1].Value;
            await DebugLogger.WriteLogAsync($"AJAX请求URL: {postUrl}");
            return (postUrl, formData);
        }

        internal static async Task<string> GetDownloadLinkAsync(string url, string password = null)
        {
            await DebugLogger.WriteLogAsync($"开始获取下载链接: {url}, 密码: {password ?? "无"}");

            var uri = new Uri(url);
            var domain = uri.GetLeftPart(UriPartial.Authority);
            await DebugLogger.WriteLogAsync($"域名: {domain}");
            await ProcessAcwScV2Challenge(new Uri(domain), url);

            var html = await Downloader.DownloadStringAsync(url);

            var referrer = url;

            if (string.IsNullOrEmpty(password))
            {
                await DebugLogger.WriteLogAsync("无密码，检查iframe");
                var iframeMatch = Globals.IframeSrcRegex.Match(html);
                if (iframeMatch.Success)
                {
                    referrer = domain + iframeMatch.Groups[1].Value;
                    await DebugLogger.WriteLogAsync($"找到iframe，跳转到: {referrer}");
                    html = await Downloader.DownloadStringAsync(referrer);
                }
            }

            var cleanHtml = Globals.JavaScriptCommentRegex.Replace(html, "");

            var (postUrl, formData) = await ExtractAjaxDataAsync(cleanHtml, domain, password);

            var jsonResponse = await HttpClientWrapper.SendRequestAsync(postUrl, HttpUtils.GetStringFromResponse, HttpMethod.Post, HttpUtils.SetFormContent(formData, referrer));
            await DebugLogger.WriteLogAsync($"收到JSON响应: {jsonResponse}");

            dynamic response = Json.DeserializeObject(jsonResponse);
            string resultCode = $"{response["zt"]}";
            await DebugLogger.WriteLogAsync($"状态响应代码: {resultCode}");

            if (resultCode == "1")
            {
                string downloadUrl = $"{response["dom"]}/file/{response["url"]}";
                await DebugLogger.WriteLogAsync($"获取下载链接: {downloadUrl}");

                string finalUrl = await HttpUtils.GetLocationFromUrlAsync(downloadUrl);
                await DebugLogger.WriteLogAsync($"最终下载链接: {finalUrl}");

                return finalUrl;
            }
            else
            {
                string errorMsg = $"错误：{response["inf"]}";
                await DebugLogger.WriteLogAsync(errorMsg);
                return errorMsg;
            }
        }

        internal static async Task<string> GetShareLinksFromFolder(string url, string password = null)
        {
            await DebugLogger.WriteLogAsync($"开始获取文件夹分享链接: {url}, 密码: {password ?? "无"}");

            var uri = new Uri(url);
            var domain = uri.GetLeftPart(UriPartial.Authority);
            await DebugLogger.WriteLogAsync($"域名: {domain}");
            await ProcessAcwScV2Challenge(new Uri(domain), url);

            var html = await Downloader.DownloadStringAsync(url);

            var referrer = url;
            var cleanHtml = Globals.JavaScriptCommentRegex.Replace(html, "");

            var (postUrl, formData) = await ExtractAjaxDataAsync(cleanHtml, domain, password);

            bool lastPage = false;
            StringBuilder files = new StringBuilder();
            int currentPage = int.Parse(formData["pg"]);
            int totalFiles = 0;

            do
            {
                await DebugLogger.WriteLogAsync($"开始处理第 {currentPage} 页");

                var jsonResponse = await HttpClientWrapper.SendRequestAsync(postUrl, HttpUtils.GetStringFromResponse, HttpMethod.Post, HttpUtils.SetFormContent(formData, referrer));
                await DebugLogger.WriteLogAsync($"收到第 {currentPage} 页响应，内容: {jsonResponse}");

                dynamic response = Json.DeserializeObject(jsonResponse);
                string resultCode = $"{response["zt"]}";
                await DebugLogger.WriteLogAsync($"状态响应代码: {resultCode}");
                if (resultCode == "1")
                {
                    int fileCount = ((response["text"] as object[])?.Length) ?? ((response["text"] as List<object>)?.Count ?? 0);
                    await DebugLogger.WriteLogAsync($"第 {currentPage} 页文件数量: {fileCount}");

                    for (int i = 0; i < fileCount; i++)
                    {
                        var file = response["text"][i];
                        string fileName = file["name_all"];
                        string fileSize = file["size"];
                        string uploadTime = file["time"];
                        string fileUrl = $"{domain}/{file["id"]}";

                        files.Append($"文件名：{fileName}\n大小：{fileSize}\n上传时间：{uploadTime}\n链接：{fileUrl}\n\n----------------------------------------------------\n\n");
                        totalFiles++;
                    }

                    await DebugLogger.WriteLogAsync($"已添加 {fileCount} 个文件");

                    if ((fileCount > 0 && fileCount < 50) || currentPage >= 2)
                    {
                        lastPage = true;
                        files.Append("\n【提示】 请勿滥用此功能，最多显示前100个文件列表\n");
                    }
                    else
                    {
                        currentPage++;
                        formData["pg"] = currentPage.ToString();
                        await DebugLogger.WriteLogAsync($"跳转到下一页: {currentPage}");
                        await Task.Delay(3000);
                    }
                }
                else
                {
                    string errorMsg = $"错误：{response["info"]}";
                    await DebugLogger.WriteLogAsync(errorMsg);
                    return errorMsg;
                }

            } while (!lastPage);

            await DebugLogger.WriteLogAsync($"文件夹获取完成，总共 {totalFiles} 个文件");
            return files.ToString();
        }
    }
}