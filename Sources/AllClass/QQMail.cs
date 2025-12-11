using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web;

namespace LinkSimplifier
{
    internal static class QQMail
    {
        internal static async Task<string> GetDownloadLinkAsync(string url)
        {
            var uri = new Uri(url);
            var query = HttpUtility.ParseQueryString(uri.Query);

            if (query["key"] is string key && query["code"] is string code)
            {
                return await HttpUtils.GetLocationFromUrlAsync(
                    $"https://wx.mail.qq.com/ftn/download?func=4&key={key}&code={code}"
                );
            }

            var formData = new[] { new KeyValuePair<string, string>("f", "json") };
            var r = $"{(long)(Globals.RandomInstance.NextDouble() * 1e13)}{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}";
            var referrer = uri.GetLeftPart(UriPartial.Authority);
            var jsonResponse = await HttpClientWrapper.SendRequestAsync(
                $"{url}&r={r}&sid=", HttpUtils.GetStringFromResponse, HttpMethod.Post, HttpUtils.SetFormContent(formData,referrer)
            );
            var downloadUrl = ((dynamic)Json.DeserializeObject(jsonResponse))["body"]["url"];
            return await HttpUtils.GetLocationFromUrlAsync(downloadUrl);
        }
    }
}