using System.Web.Script.Serialization;

namespace LinkSimplifier
{
    internal class Json
    {
        private static readonly JavaScriptSerializer Serializer = new JavaScriptSerializer();

        internal static object DeserializeObject(string jsonText)
        {
            return Serializer.DeserializeObject(jsonText);
        }

        internal static string SerializeObject(object obj)
        {
            return Serializer.Serialize(obj);
        }
    }
}
