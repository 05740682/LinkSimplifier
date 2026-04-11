using LinkSimplifier.Services.Providers;
using LinkSimplifier.Utils;
using System;
using System.Threading.Tasks;

namespace LinkSimplifier.Services
{
    internal static class UrlProcessor
    {
        internal static async Task<string> ProcessUrlAsync(string url)
        {
            if (string.IsNullOrWhiteSpace(url) || !RegexPatterns.HttpProtocolRegex.IsMatch(url))
                throw new ArgumentException("无效的URL地址");

            try
            {
                var host = new Uri(url).Host.ToLower();

                if (host.Contains("mail.qq"))
                {
                    DebugLogger.Write("路由匹配: QQMail");
                    return await ProcessQQMailUrlAsync(url);
                }

                if (host.Contains("lanzou"))
                {
                    DebugLogger.Write("路由匹配: LanZou");
                    return await ProcessLanZouUrlAsync(url);
                }

                DebugLogger.Write("路由匹配: Default (Direct Link)");
                return url;
            }
            catch (UriFormatException)
            {
                throw new ArgumentException("URL格式错误");
            }
        }

        private static async Task<string> ProcessQQMailUrlAsync(string url)
        {
            return await QQMail.GetDownloadLinkAsync(url);
        }

        private static async Task<string> ProcessLanZouUrlAsync(string url)
        {
            var (isFolder, password, baseUrl) = ExtractUrlParameters(url);
            DebugLogger.Write($"Folder: {isFolder}");
            if (!isFolder)
            {
                return await Lanzou.GetDownloadLinkAsync(baseUrl, password);
            }
            return await Lanzou.GetShareLinksFromFolder(baseUrl, password);
        }

        private static (bool isFolder, string password, string baseUrl) ExtractUrlParameters(string url)
        {
            bool isFolder = RegexPatterns.FolderParamRegex.IsMatch(url);
            string processedUrl = isFolder ? RegexPatterns.FolderParamRegex.Replace(url, "") : url;
            return (isFolder, RegexPatterns.PasswordParamRegex.Match(processedUrl).Groups[1].Value, RegexPatterns.PasswordParamRegex.Replace(processedUrl, ""));
        }
    }

}
