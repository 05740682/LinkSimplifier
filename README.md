# LinkSimplifier

一款轻量、高效的云盘直链解析工具，提供基于 C# WPF 的桌面客户端和  
基于 Cloudflare Workers & Pages 的 Web 版本。

## 项目特点

- **快速直链获取**：一键解析获取可直接下载的直链地址
- **加密链接支持**：支持带密码的分享链接解析
- **文件夹解析**：支持解析文件夹

## 在线体验与部署

- **在线解析**：[linksimplifier.test0001.bond](https://linksimplifier.test0001.bond)

1. **环境要求**
   - Node.js
   - Cloudflare 账号
   - 已创建好具备 Workers 部署权限的 API Token

2. **安装 pnpm 和 Wrangler**
   ```bash
   npm install -g pnpm@latest-10
   pnpm add -g wrangler@latest
   ```

3. **下载并解压项目**
   - 下载地址：[LinkSimplifier-master.zip](https://github.com/05740682/LinkSimplifier/archive/refs/heads/master.zip)
   - 解压后进入目录：
   ```bash
   cd "LinkSimplifier-master/Sources/Cloudflare Pages"
   ```

4. **配置环境变量**
   在当前目录下创建 `.env` 文件：
   ```env
   CLOUDFLARE_API_TOKEN=你的_API_Token
   CLOUDFLARE_ACCOUNT_ID=你的_Account_ID
   ```

   > 注意：`.env` 含敏感信息，请勿提交到 Git 仓库，建议加入 `.gitignore`。

5. **部署到 Cloudflare**
   ```bash
   wrangler deploy
   ```

## 支持平台

| 云盘 | 解析支持 | 官网链接 |
| :--- | :--- | :--- |
| **QQ 邮箱中转站** | 单文件 | [mail.qq.com](https://mail.qq.com) |
| **蓝奏云** | 单文件 / 文件夹 | [lanzou.com](https://www.lanzou.com) |

## 使用指南

### 1. 基础操作
将云盘分享链接复制到输入框，点击 **【开始解析】** 即可。

### 2. 参数化链接格式
为了方便快速解析，工具支持在链接后追加特定参数：

| 场景 | 格式示例 | 参数说明 |
| :--- | :--- | :--- |
| **普通文件** | `https://xxx.com/xxxx` | 直接粘贴原始链接 |
| **带密码文件** | `https://xxx.com/xxxx&pwd=1234` | 追加 `&pwd=密码` |
| **普通文件夹** | `https://xxx.com/xxxx&folder` | 追加 `&folder`  |
| **加密文件夹** | `https://xxx.com/xxxx&pwd=1234&folder` | 同时追加密码与文件夹参数 |

## 免责声明

1. 本工具仅提供直链解析功能，不存储、不分发、不传播任何实际文件，亦不对工具的稳定性作任何保证。
2. 用户须严格遵守当地法律法规。因使用本工具引发的一切法律纠纷与责任，均由相关行为人独立承担，  
   原作者不承担任何直接、间接或连带的法律责任。
