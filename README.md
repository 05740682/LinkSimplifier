# LinkSimplifier

一款轻量、高效的云盘直链解析工具，支持桌面端与 Web 端。

## 🚀 项目特点

- **多端覆盖**：提供基于 C# WPF 的桌面客户端及基于 Cloudflare Pages 的 Web 版本。
- **无需安装**：通过 Web 版 [linksimplifier.test0001.bond](https://linksimplifier.test0001.bond) 即可在手机或电脑端即开即用。
- **一键直链**：跳过广告与中转页面，直接获取文件下载地址。
- **支持加密**：完美兼容带提取码的分享链接。
- **开源自由**：支持通过 Cloudflare Workers 自行部署专属解析接口。

---

## 🌐 在线体验与部署

- **在线解析**：[linksimplifier.test0001.bond](https://linksimplifier.test0001.bond)
- **自部署脚本**：[`_worker.js`](https://github.com/05740682/LinkSimplifier/raw/refs/heads/master/Sources/Cloudflare%20Pages/_worker.js)
  > 您可以将此脚本部署到自己的 Cloudflare Workers 中，实现私有化解析服务。

---

## 🛠️ 支持平台

| 云盘平台 | 解析能力 | 官网地址 |
| :--- | :--- | :--- |
| **蓝奏云** | 单文件 / 文件夹 | [lanzou.com](https://www.lanzou.com) |
| **QQ 邮箱中转站** | 单文件直链 | [mail.qq.com](https://mail.qq.com) |

---

## 📖 使用指南

### 1. 基础操作
将云盘分享链接复制到输入框，点击 **【开始解析】** 即可。

### 2. 参数化链接格式
为了方便快速解析，工具支持在链接后追加特定参数：

| 场景 | 格式示例 | 参数说明 |
| :--- | :--- | :--- |
| **普通文件** | `https://xxx.com/xxxx` | 直接粘贴原始链接 |
| **带密码文件** | `https://xxx.com/xxxx&pwd=1234` | 追加 `&pwd=密码` |
| **普通文件夹** | `https://xxx.com/xxxx&folder` | 追加 `&folder` 标识 |
| **加密文件夹** | `https://xxx.com/xxxx&pwd=1234&folder` | 同时追加密码与文件夹参数 |

---

## 💻 桌面端开发环境

如果您需要修改桌面端代码，请确保具备以下环境：
- **开发工具**：Visual Studio 2022 及以上
- **运行环境**：.NET Framework 4.8
- **技术栈**：C# / WPF

---

## ⚠️ 免责声明

1. 本工具仅供技术交流与学习使用，请勿用于非法用途。
2. 解析结果均来自第三方云盘，本工具不存储任何文件内容。
3. 请尊重版权，遵守各平台的使用协议。

---

**项目开源地址**：[GitHub - 05740682/LinkSimplifier](https://github.com/05740682/LinkSimplifier)  
*如果这个项目对你有帮助，欢迎点一个 Star！⭐*
