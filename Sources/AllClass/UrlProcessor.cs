using System;
using System.Threading.Tasks;

namespace LinkSimplifier
{
    internal static class UrlProcessor
    {
        internal static async Task<string> ProcessUrlAsync(string url)
        {
            if (string.IsNullOrWhiteSpace(url) || !Globals.HttpProtocolRegex.IsMatch(url))
                throw new ArgumentException("无效的URL地址");

            try
            {
                var host = new Uri(url).Host;
                if (host.Contains("mail.qq")) return await ProcessQQMailUrlAsync(url);
                if (host.Contains("lanzou")) return await ProcessLanZouUrlAsync(url);
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
            if (!isFolder)
            {
                return await Lanzou.GetDownloadLinkAsync(baseUrl, password);
            }
            return await Lanzou.GetShareLinksFromFolder(baseUrl,password);
        }

        private static (bool isFolder, string password, string baseUrl) ExtractUrlParameters(string url)
        {
            bool isFolder = Globals.FolderParamRegex.IsMatch(url);
            string processedUrl = isFolder ? Globals.FolderParamRegex.Replace(url, "") : url;
            return (isFolder, Globals.PasswordParamRegex.Match(processedUrl).Groups[1].Value, Globals.PasswordParamRegex.Replace(processedUrl, ""));
        }
    }
}