# Cupbox 1.1.0 Windows 安装版

双击 `release/Cupbox-Setup-1.1.0-x64.exe`，按中文引导选择安装位置与快捷方式。
支持 Windows 10 2004（19041）及以上的 x64 兼容系统；Windows 11 ARM64 需使用系统 x64 模拟。
默认仅为当前用户安装到 `%LOCALAPPDATA%\Programs\Cupbox`，不要求管理员权限。

## 安装引导

- 欢迎页与完成页使用应用现有的原创樱花工作室图片、Cupbox Logo，提供深浅两套高分辨率素材。
- 原生 Windows 11 风格控件随系统深浅色设置切换，底部显示当前步骤，支持键盘导航。
- 安装前有一页简短上手介绍；应用位置、开始菜单入口和桌面入口可选择。
- 安装完成后由用户勾选是否立即打开，不添加开机自启。
- 程序、运行时、主题和依赖完整内置，安装过程无需联网。模型调用仍需相应服务连接。

## 更新与卸载

再次运行安装包可覆盖安装，沿用既有安装位置与快捷方式选择。更新前请保存任务并退出应用；
安装器检测到文件被使用时会提示处理，不强制结束应用。

通过 Windows“设置 → 应用”或开始菜单的“卸载 Cupbox”移除程序。
卸载只移除安装器登记的程序文件和快捷方式，不删除用户对话、模型配置、主题、工作目录。
默认数据目录为系统“文档\Cupbox”（文档目录可能被系统重定向），设置 `CUPBOX_HOME` 时使用其下的 `.cupbox` 文件夹。
安装器不写入密钥、示例模型或初始偏好，也不更改已有的执行权限设置。

## 构建

1. 准备项目依赖和 Windows 版 Inno Setup 6.7+。编译器来源：[官方网站](https://jrsoftware.org/isdl.php)。
2. 必要时设置 `ISCC_PATH` 为 `ISCC.exe` 的完整路径。
3. 在项目根目录运行 `npm run pack:installer`。

脚本重新编译 TypeScript、生成引导图片，并在 `output/installer-stage/Cupbox` 独立暂存完整应用，
随后输出安装 EXE 和同名 `.sha256` 校验文件，并同步更新 `release/Cupbox可视化` 中的便携版，保证两种启动方式功能一致。不会清空 `release` 或删除用户数据。
根目录与桌面版本必须一致；版本保持 1.1.0。未引入应用运行依赖。

入口：`desktop/installer/build.mjs`；界面文案与安装规则：`desktop/installer/cupbox.iss`；
图片合成：`desktop/installer/build-assets.mjs`。修改图片后重新构建即可。

简体中文语言文件固定来自 Inno Setup 官方源码标签 `is-6_7_3`，保留译者署名与上游许可。
引导图片复用应用已有生成素材，品牌字形使用可编辑矢量图合成；本次没有调用图像生成服务。

## 签名与校验

此本地构建没有配置发行者的代码签名证书，生成的安装包未签名；产品名与图标不等于数字签名。
正式公开分发时可接入自己的 Authenticode 证书后重新计算 SHA256。不要修改系统安全设置。

PowerShell 校验：`Get-FileHash .\release\Cupbox-Setup-1.1.0-x64.exe -Algorithm SHA256`，
与同目录 `.sha256` 文件比较。SHA256 用于核对文件完整性，不证明发行者身份。

## 本次验证

已实际验证：中文含空格路径安装、当前用户卸载登记、1.0.3 版本信息、同版本覆盖安装、
安装后界面与 IPC 桥、模型选择和思考深度控件、既有配置读取、卸载与用户文件保留。
安装器欢迎页及上手介绍页已检查实际窗口，深浅两套图片已目视检查。

验证使用独立测试 AppId，与正式包共用安装规则和应用载荷，测试路径限定在项目 `output` 内，
不覆盖已有正式安装，不使用真实密钥或模型额度。测试代码不运行模型请求。
重跑：`pwsh -File desktop/installer/verify.ps1`（会重新编译测试安装器）。
测试 AppId 仅在定义 `InstallerTest` 时生效，正式构建不传入该定义。

另验证了打包输出路径保护：拒绝工作区根目录、release 根目录和工作区外路径；原有便携版保留。
日志位于 `output/installer-verification.log` 和 `output/installer-test/`。
