using System;
using System.Net;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

namespace LinkSimplifier
{
    internal static class HttpClientWrapper
    {
        internal static HttpClient Client => _client;
        internal static CookieContainer CookieContainer => _handler.CookieContainer;

        private static readonly HttpClient _client;
        private static readonly HttpClientHandler _handler;
        private static bool _disposed = false;

        static HttpClientWrapper()
        {
            _handler = new HttpClientHandler
            {
                AllowAutoRedirect = false,
                AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate,
                CookieContainer = new CookieContainer(),
                UseCookies = true,
                UseProxy = false,
            };
            _client = new HttpClient(_handler) { Timeout = Timeout.InfiniteTimeSpan };
            _client.DefaultRequestHeaders.Accept.ParseAdd(RequestHeaders.Accept);
            _client.DefaultRequestHeaders.AcceptLanguage.ParseAdd(RequestHeaders.AcceptLanguage);
            _client.DefaultRequestHeaders.UserAgent.ParseAdd(RequestHeaders.UserAgent);
        }

        internal static async Task<T> SendRequestAsync<T>(string url, Func<HttpResponseMessage, Task<T>> processResponse, HttpMethod method = null, Action<HttpRequestMessage> configureRequest = null, CancellationToken ct = default)
        {
            using (var request = new HttpRequestMessage(method ?? HttpMethod.Get, url))
            {
                configureRequest?.Invoke(request);
                using (var response = await _client.SendAsync(request, (request.Method == HttpMethod.Get || request.Method == HttpMethod.Head) ? HttpCompletionOption.ResponseHeadersRead : HttpCompletionOption.ResponseContentRead, ct))
                {
                    return await processResponse(response);
                }
            }
        }

        internal static void Dispose()
        {
            if (_disposed) return;
            _client?.Dispose();
            _disposed = true;
        }
    }
}