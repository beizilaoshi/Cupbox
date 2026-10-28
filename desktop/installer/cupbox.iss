; Cupbox personalized Windows wizard. Inno Setup 6.7+; no download at install time.
#ifndef AppVersion
  #error AppVersion must be supplied by build.mjs
#endif
#define Root "..\.."
#ifndef PayloadRoot
  #define PayloadRoot Root + "\output\installer-stage\Cupbox"
#endif
#define Product "Cupbox 可视化"
#define Exe "Cupbox可视化.exe"

[Setup]
#ifdef InstallerUIReview
#ifndef InstallerTest
  #error InstallerUIReview requires InstallerTest
#endif
AppId={{B9851FE8-90EF-4CB5-A3B2-532FD534AE8F}
#else
#ifdef InstallerTest
; Identical payload, separate registration for verification beside a real install.
AppId={{DC8B23F6-11C4-44D2-8E7B-8D84125039AB}
#else
AppId={{45F071A1-02B1-4C9A-9936-DF81C8B6C6AC}
#endif
#endif
AppName={#Product}
AppVersion={#AppVersion}
AppVerName={#Product} {#AppVersion}
AppPublisher=Cupbox
AppPublisherURL=https://github.com/beizilaoshi/cupbox
VersionInfoVersion={#AppVersion}.0
VersionInfoDescription=Cupbox 桌面应用安装程序
VersionInfoProductName={#Product}
VersionInfoProductVersion={#AppVersion}
DefaultDirName={localappdata}\Programs\Cupbox
DefaultGroupName=Cupbox
DisableProgramGroupPage=yes
DisableDirPage=no
DisableWelcomePage=no
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.19041
#ifdef InstallerTest
OutputDir={#Root}\output\installer-review
#ifdef InstallerUIReview
OutputBaseFilename=Cupbox-UI-Review
#else
OutputBaseFilename=Cupbox-Setup-{#AppVersion}-x64-test
#endif
#else
OutputDir={#Root}\release
OutputBaseFilename=Cupbox-Setup-{#AppVersion}-x64
#endif
SetupIconFile=..\ui\assets\cupbox-logo.ico
UninstallDisplayIcon={app}\resources\app\desktop\ui\assets\cupbox-logo.ico
UninstallDisplayName={#Product}
#ifdef InstallerTest
; Verification payloads keep the identical files without repeating production compression.
Compression=none
SolidCompression=no
#else
Compression=lzma2/normal
SolidCompression=yes
#endif
LZMANumBlockThreads=2
WizardStyle=modern light windows11 excludelightcontrols hidebevels includetitlebar
WizardSizePercent=150,140
WizardImageFile=assets\wizard-light.png
WizardImageFileDynamicDark=assets\wizard-dark.png
WizardSmallImageFile=assets\wizard-logo.png
WizardImageStretch=yes
DisableReadyPage=no
CloseApplications=yes
RestartApplications=no
AllowCancelDuringInstall=yes
SetupLogging=yes
ShowLanguageDialog=no
UsePreviousAppDir=yes
UsePreviousTasks=yes
Uninstallable=yes

[Languages]
Name: "zhcn"; MessagesFile: "vendor\ChineseSimplified.isl"

[LangOptions]
DialogFontName=Microsoft YaHei UI
WelcomeFontName=Microsoft YaHei UI

[Messages]
WelcomeLabel1=让灵感，轻轻启程。
WelcomeLabel2=欢迎来到 Cupbox。%n%n一个安静、顺手的 AI 工作台，把对话、模型和本地工具放在一起。%n%n接下来，你可以选择安装位置和快捷方式。安装过程无需联网。%n%nCupbox {#AppVersion} · Windows 10 / 11
WizardSelectDir=给 Cupbox 找个位置
SelectDirDesc=应用放在这里，你的创作另有归处。
SelectDirLabel3=选择应用程序的安装文件夹。已有的对话、模型配置和自定义主题会继续保留。
WizardSelectTasks=安排好你的入口
SelectTasksDesc=常用的入口，由你决定。
SelectTasksLabel2=选择你喜欢的启动方式。应用不会添加开机自启。
WizardReady=一切就绪，准备启程
ReadyLabel1=确认下面的选择，点击“开始安装”即可。
ButtonInstall=开始安装(&I)
WizardInstalling=正在布置你的工作台
InstallingLabel=正在将 Cupbox 安装到电脑，请稍候。
FinishedHeadingLabel=你的工作台，准备好了。
FinishedLabel=Cupbox 已安装完成。%n%n第一次打开时，可在设置中选择主题、添加模型和调整启动动画。%n%n对话与配置默认保存在“文档\Cupbox”；卸载仅移除程序文件。设置 CUPBOX_HOME 时，数据位于其下的 .cupbox 文件夹。
ConfirmUninstall=要卸载 %1 吗？%n%n此操作将移除程序和快捷方式。你的对话、模型配置、自定义主题及工作文件会保留。
BeveledLabel=CUPBOX  /  {#AppVersion}
UninstallStatusLabel=正在移除程序文件，你的对话和配置将保留。

[Tasks]
Name: "startmenu"; Description: "在开始菜单中添加 Cupbox"; GroupDescription: "快捷方式"
Name: "desktopicon"; Description: "在桌面放一个 Cupbox 快捷方式"; GroupDescription: "快捷方式"; Flags: unchecked

[Files]
Source: "assets\feature-*.png"; Flags: dontcopy
Source: "assets\banner-*.png"; Flags: dontcopy
Source: "assets\skin-*.png"; DestDir: "{app}\setup-art"; Flags: ignoreversion
Source: "assets\uninstall-hero.png"; DestDir: "{app}\setup-art"; Flags: ignoreversion
#ifndef InstallerUIReview
Source: "{#PayloadRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
#endif

[Icons]
Name: "{userprograms}\Cupbox\Cupbox"; Filename: "{app}\{#Exe}"; WorkingDir: "{app}"; IconFilename: "{app}\resources\app\desktop\ui\assets\cupbox-logo.ico"; AppUserModelID: "Cupbox.Desktop"; Tasks: startmenu
Name: "{userprograms}\Cupbox\卸载 Cupbox"; Filename: "{uninstallexe}"; Tasks: startmenu
Name: "{autodesktop}\Cupbox"; Filename: "{app}\{#Exe}"; WorkingDir: "{app}"; IconFilename: "{app}\resources\app\desktop\ui\assets\cupbox-logo.ico"; Tasks: desktopicon; AppUserModelID: "Cupbox.Desktop"

[Run]
Filename: "{app}\{#Exe}"; Description: "现在打开 Cupbox，让灵感启程"; Flags: nowait postinstall skipifsilent unchecked

[Code]
#include "experience.iss"
