using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Threading.Tasks;

namespace LinkSimplifier
{
    internal static class HttpUtils
    {
        internal static Func<HttpResponseMessage, Task<string>> GetStringFromResponse = async response =>
        {
            response.EnsureSuccessStatusCode();
            return await response.Content.ReadAsStringAsync();
        };

        internal static Action<HttpRequestMessage> SetFormContent(IEnumerable<KeyValuePair<string, string>> formData, string referrer = null)
        {
            return request =>
            {
                request.Content = new FormUrlEncodedContent(formData);
                if (!string.IsNullOrEmpty(referrer))
                {
                    request.Headers.Referrer = new Uri(referrer);
                }
            };
        }

        internal static async Task<string> GetLocationFromUrlAsync(string url)
        {
            return await HttpClientWrapper.SendRequestAsync(url, async response =>
            {
                if ((int)response.StatusCode >= 300 && (int)response.StatusCode <= 399)
                {
                    return await Task.FromResult(response.Headers.Location?.ToString());
                }
                return await Task.FromResult<string>(null);
            }, HttpMethod.Head);
        }

        internal static string GetFileNameFromHeaders(HttpContentHeaders contentHeaders)
        {
            try
            {
                if (contentHeaders.TryGetValues("Content-Disposition", out var values))
                {
                    var match = Globals.ContentDispositionFilenameRegex.Match(values.FirstOrDefault() ?? "");
                    if (match.Success) { return Uri.UnescapeDataString(match.Groups[2].Value); }
                }
            }
            catch { }
            return Guid.NewGuid().ToString("N");
        }
    }
}

