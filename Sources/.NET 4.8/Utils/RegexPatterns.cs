using System.Text.RegularExpressions;

namespace LinkSimplifier.Utils
{
    internal static class RegexPatterns
    {
        internal static readonly Regex ContentDispositionFilenameRegex = new Regex(@"filename\*=(?:([^'']*)'')?([^;]+)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex FolderParamRegex = new Regex(@"&folder", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex HttpProtocolRegex = new Regex(@"^https?://", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex IframeSrcRegex = new Regex(@"<iframe[^>]*?src\s*=\s*[""']?([^""'\s>]*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex PasswordParamRegex = new Regex(@"&pwd=(.*)", RegexOptions.Compiled | RegexOptions.IgnoreCase);

        internal static readonly Regex JavaScriptAjaxUrlRegex = new Regex(@"url\s*:\s*'([^']*)'", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptAjaxDataRegex = new Regex(@"data\s*:\s*\{\s*([^}]+)\s*\}", RegexOptions.Compiled | RegexOptions.Singleline | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptCommentRegex = new Regex(@"(//[^\r\n]*|/\*[\s\S]*?\*/)(?=([^""'`]*(?:""[^""\\]*(?:\\.[^""\\]*)*""|'[^'\\]*(?:\\.[^'\\]*)*'|`[^`\\]*(?:\\.[^`\\]*)*`))*[^""'`]*$)", RegexOptions.Compiled | RegexOptions.Multiline);
        internal static readonly Regex JavaScriptVarRegex = new Regex(@"var\s+(\w+)\s*=\s*(\d+|'[^']+'|""[^""]+"")\s*;", RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex JavaScriptAjaxDataKeyValueRegex = new Regex(@"'([^']+)'\s*:\s*('([^']*)'|""([^""]*)""|([^,\s}]+))",RegexOptions.Compiled | RegexOptions.IgnoreCase);
        internal static readonly Regex AcwScV2ArgRegex = new Regex(@"var arg1='([^']+)'", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    }
}
