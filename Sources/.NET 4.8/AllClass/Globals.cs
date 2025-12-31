using System;
using System.IO;
using System.Text.RegularExpressions;

namespace LinkSimplifier
{
    internal class Globals
    {
        internal static readonly Random RandomInstance = new Random();

        internal static readonly Regex ContentDispositionFilenameRegex = new Regex(@"filename\*=(?:([^'']*)'')?([^;]+)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex FolderParamRegex = new Regex(@"&folder", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex HttpProtocolRegex = new Regex(@"^https?://", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex IframeSrcRegex = new Regex(@"<iframe[^>]*?src\s*=\s*[""']?([^""'\s>]*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex PasswordParamRegex = new Regex(@"&pwd=(.*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        internal static readonly Regex JavaScriptAjaxUrlRegex = new Regex(@"url\s*:\s*'([^']*)'", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptAjaxDataRegex = new Regex(@"data\s*:\s*\{\s*([^}]+)\s*\}", RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptCommentRegex = new Regex(@"(//[^\r\n]*|/\*[\s\S]*?\*/)(?=([^""'`]*(?:""[^""\\]*(?:\\.[^""\\]*)*""|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`))*[^""'`]*$)", RegexOptions.Compiled | RegexOptions.Multiline);
        internal static readonly Regex JavaScriptVarRegex = new Regex(@"var\s+(\w+)(?:\s*=\s*([^;]+))?;", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptAssignRegex = new Regex(@"(\w+)\s*=\s*([^;]+);", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        internal static readonly Regex AcwScV2ArgRegex = new Regex(@"var arg1='([^']+)'", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        internal static readonly string[] Paths = { Path.GetTempPath(), AppDomain.CurrentDomain.BaseDirectory, Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData) };
    }
    internal class RequestHeaders
    {
        internal static string Accept = "*/*";
        internal static string AcceptLanguage = "zh-CN,zh;q=0.9";
        internal static string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/999.0.0.0 Safari/537.36";
    }
}
