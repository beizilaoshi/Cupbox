// Cupbox's offline installer and uninstaller share artwork, type and data policy.
const
  Ink = $00634F40;
  MutedInk = $00907B70;
  Paper = $00FFF9F7;
  Card = $00FFF2EE;
var
  StepLabel, FeatureDetail, FeatureTitle, InstallPercent, InstallTip: TNewStaticText;
  FeatureButtons: array[0..2] of TBitmapButton;
  ActiveFeature: Integer;
  UninstallArtPath: String;
  BrandedUninstall: Boolean;
  SkinFolder: String;
  SkinTimer: LongWord;
  SkinCount: Integer;
  Skins: array[0..15] of record
    Button: TBitmapButton;
    Native: TNewButton;
    Key: String;
    Frame: Integer;
  end;
  NavBack, NavNext, NavCancel: TBitmapButton;
  FooterPanel: TPanel;
  FooterReady: Boolean;
  ProgressViewActive: Boolean;
  ProgressTrack, ProgressFill: TBitmapImage;
  ProgressPercent: TNewStaticText;
  LastProgressPercent: Integer;
type
  TCursorPoint = record X,Y: Integer; end;
function SkinSetTimer(Wnd,ID: LongWord; Interval: Cardinal; Callback: LongWord): LongWord;
external 'SetTimer@user32.dll stdcall';
function SkinKillTimer(Wnd,ID: LongWord): Boolean;
external 'KillTimer@user32.dll stdcall';
function SkinCursor(var Point: TCursorPoint): Boolean;
external 'GetCursorPos@user32.dll stdcall';
function SkinToClient(Wnd: LongWord; var Point: TCursorPoint): Boolean;
external 'ScreenToClient@user32.dll stdcall';

function TextAt(Owner: TComponent; Parent: TWinControl; L,T,W,H: Integer;
  Caption: String; Size: Integer; Color: TColor): TNewStaticText;
begin
  Result := TNewStaticText.Create(Owner);
  Result.Parent := Parent;
  Result.AutoSize := False;
  Result.WordWrap := True;
  Result.SetBounds(L,T,W,H);
  Result.Caption := Caption;
  Result.Font.Size := Size;
  Result.Font.Color := Color;
  Result.Font.Name := 'Microsoft YaHei';
end;

procedure SkinClick(Sender: TObject);
var I: Integer;
begin
  for I:=0 to SkinCount-1 do
    if Skins[I].Button=Sender then begin
      if Skins[I].Native.Enabled then
        SendMessage(Skins[I].Native.Handle,$00F5,0,0);
      Exit;
    end;
end;

procedure SkinTick(Wnd: LongWord; Msg: Cardinal; ID: LongWord; Time: Cardinal);
var I,Target,Range,Percent,FillWidth: Integer; P: TCursorPoint; Hover: Boolean;
begin
  if ProgressViewActive then begin
    if UninstallProgressForm=nil then ProgressViewActive:=False
    else begin
      Range:=UninstallProgressForm.ProgressBar.Max-UninstallProgressForm.ProgressBar.Min;
      Percent:=0;if Range>0 then Percent:=Round(100.0*(UninstallProgressForm.ProgressBar.Position-UninstallProgressForm.ProgressBar.Min)/Range);
      if Percent<0 then Percent:=0;if Percent>100 then Percent:=100;
      if Percent<>LastProgressPercent then begin
        ProgressPercent.Caption:=IntToStr(Percent)+'%';LastProgressPercent:=Percent;
        Log('CUPBOX_UNINSTALL_PROGRESS percent='+IntToStr(Percent));
        FillWidth:=Round(ProgressTrack.Width*Percent/100.0);
        ProgressFill.Visible:=FillWidth>0;if FillWidth>0 then ProgressFill.Width:=FillWidth;
      end;
    end;
  end;
  for I:=0 to SkinCount-1 do begin
    Skins[I].Button.Enabled := Skins[I].Native.Enabled;
    Skins[I].Button.Visible := Skins[I].Native.Visible;
    if Skins[I].Button.Showing then begin
      SkinCursor(P);SkinToClient(Skins[I].Button.Handle,P);
      Hover := (P.X>=0) and (P.Y>=0) and (P.X<Skins[I].Button.Width) and (P.Y<Skins[I].Button.Height);
      Target:=0;
      if Skins[I].Button.Enabled and (Hover or Skins[I].Button.Focused) then Target:=4;
      if Skins[I].Frame<Target then Skins[I].Frame:=Skins[I].Frame+1
      else if Skins[I].Frame>Target then Skins[I].Frame:=Skins[I].Frame-1
      else Continue;
      Skins[I].Button.PngImage.LoadFromFile(SkinFolder+'\skin-'+Skins[I].Key+'-'+IntToStr(Skins[I].Frame)+'.png');
    end;
  end;
end;

function SkinButton(Owner: TComponent; Parent: TWinControl; Native: TNewButton;
  L,T,W,H: Integer; Key, Caption: String): TBitmapButton;
begin
  Result:=TBitmapButton.Create(Owner);Result.Parent:=Parent;
  Result.SetBounds(L,T,W,H);Result.Stretch:=True;Result.BackColor:=clNone;
  Result.Caption:=Caption;Result.Cursor:=crHand;Result.OnClick:=@SkinClick;
  Result.PngImage.LoadFromFile(SkinFolder+'\skin-'+Key+'-0.png');
  Skins[SkinCount].Button:=Result;Skins[SkinCount].Native:=Native;
  Skins[SkinCount].Key:=Key;Skins[SkinCount].Frame:=0;SkinCount:=SkinCount+1;
  Native.Left:=-ScaleX(2000);Native.TabStop:=False;
end;

procedure ChangeSkin(Button: TBitmapButton; Key, Caption: String);
var I: Integer;
begin
  Button.Caption:=Caption;
  for I:=0 to SkinCount-1 do if Skins[I].Button=Button then begin
    Skins[I].Key:=Key;Skins[I].Frame:=0;
    Button.PngImage.LoadFromFile(SkinFolder+'\skin-'+Key+'-0.png');Exit;
  end;
end;

procedure StartSkinTimer;
begin
  if SkinTimer=0 then SkinTimer:=SkinSetTimer(0,0,40,CreateCallback(@SkinTick));
end;

procedure CacheUninstallSkin;
var Find: TFindRec; Source: String;
begin
  SkinFolder:=ExpandConstant('{tmp}\cupbox-ui');ForceDirectories(SkinFolder);
  Source:=ExpandConstant('{app}\setup-art\');
  if FindFirst(Source+'skin-*.png',Find) then begin
    try repeat CopyFile(Source+Find.Name,SkinFolder+'\'+Find.Name,False);
    until not FindNext(Find);finally FindClose(Find);end;
  end;
  StartSkinTimer;
end;

function DataFolder: String;
var DataOverride: String;
begin
  DataOverride := Trim(GetEnv('CUPBOX_HOME'));
  if DataOverride <> '' then Result := AddBackslash(DataOverride) + '.cupbox'
  else Result := ExpandConstant('{userdocs}\Cupbox');
end;

procedure OpenDataFolder(Sender: TObject);
var Code: Integer;
begin
  if DirExists(DataFolder) then
    ShellExec('open', DataFolder, '', '', SW_SHOWNORMAL, ewNoWait, Code);
end;

function ArtAt(Owner: TComponent; Parent: TWinControl; L,T,W,H: Integer;
  FileName: String): TBitmapImage;
begin
  Result := TBitmapImage.Create(Owner);
  Result.Parent := Parent;
  Result.SetBounds(L,T,W,H);
  Result.Stretch := True;
  if FileExists(FileName) then Result.PngImage.LoadFromFile(FileName);
end;

procedure ShowFeature(Index: Integer);
var I: Integer; Name, Title, Detail, Path: String;
begin
  ActiveFeature := Index;
  if Index = 0 then begin
    Name := 'chat'; Title := '想聊的、想做的，从一句话开始。';
    Detail := '切换对话模型、调整思考深度，让筑梦喵陪你把灵感变成下一步。模型服务需要你在应用中配置。';
  end else if Index = 1 then begin
    Name := 'tools'; Title := '工具有章法，执行有反馈。';
    Detail := '整理文件、协作任务、连接 QQ。文件写入和命令执行受权限设置控制，请按需要开启。';
  end else begin
    Name := 'style'; Title := '把工作台，布置成喜欢的样子。';
    Detail := '樱花开场、节日衣橱、背景音乐与抱抱 Logo。进入设置，慢慢挑选你的日常。';
  end;
  FeatureTitle.Caption := Title;
  FeatureDetail.Caption := Detail;
  for I := 0 to 2 do begin
    Path:=SkinFolder+'\skin-card-'+IntToStr(I);
    if I=Index then Path:=Path+'-selected';
    FeatureButtons[I].PngImage.LoadFromFile(Path+'.png');
  end;
end;

procedure FeatureClick(Sender: TObject);
begin
  ShowFeature(TBitmapButton(Sender).Tag);
end;

procedure CycleFeature(Sender: TObject);
begin
  ShowFeature((ActiveFeature + 1) mod 3);
end;

procedure LayoutWizardFooter;
var ContentBottom, PreviousHeight, Extra, ButtonTop: Integer;
begin
  // The taller custom buttons need their own space. Keep all page content at
  // its original height and extend the form, rather than covering the notebook.
  PreviousHeight:=WizardForm.OuterNotebook.Height;
  ContentBottom:=WizardForm.OuterNotebook.Top+PreviousHeight;
  if not FooterReady then begin
    Extra:=ContentBottom+ScaleY(80)-WizardForm.ClientHeight;
    if Extra>0 then WizardForm.Height:=WizardForm.Height+Extra;
    WizardForm.OuterNotebook.Height:=PreviousHeight;
    FooterPanel:=TPanel.Create(WizardForm);FooterPanel.Parent:=WizardForm;
    FooterPanel.BevelOuter:=bvNone;FooterPanel.Color:=Paper;
    NavNext.Parent:=FooterPanel;NavBack.Parent:=FooterPanel;NavCancel.Parent:=FooterPanel;
    StepLabel.Parent:=FooterPanel;
    FooterReady:=True;
  end;
  FooterPanel.SetBounds(0,ContentBottom,WizardForm.ClientWidth,WizardForm.ClientHeight-ContentBottom);
  ButtonTop:=(FooterPanel.Height-ScaleY(42)) div 2;
  NavNext.SetBounds(FooterPanel.ClientWidth-ScaleX(182),ButtonTop,ScaleX(154),ScaleY(42));
  NavBack.SetBounds(FooterPanel.ClientWidth-ScaleX(316),ButtonTop,ScaleX(124),ScaleY(42));
  NavCancel.SetBounds(FooterPanel.ClientWidth-ScaleX(430),ButtonTop,ScaleX(104),ScaleY(42));
  StepLabel.SetBounds(ScaleX(24),ButtonTop+ScaleY(10),NavCancel.Left-ScaleX(42),ScaleY(22));
  if (FooterPanel.Top<WizardForm.OuterNotebook.Top+WizardForm.OuterNotebook.Height) or
     (ButtonTop<ScaleY(16)) or (NavNext.Top+NavNext.Height>FooterPanel.Height-ScaleY(16)) then
    RaiseException('安装向导底部布局校验失败。');
  Log(Format('CUPBOX_FOOTER page=%d contentBottom=%d footerTop=%d footerHeight=%d buttonTop=%d buttonHeight=%d', [WizardForm.CurPageID,ContentBottom,FooterPanel.Top,FooterPanel.Height,ButtonTop,NavNext.Height]));
end;

procedure InitializeWizard;
var L,W,Y,I: Integer; LabelText: TNewStaticText;
begin
  ExtractTemporaryFiles('{app}\setup-art\skin-*.png');
  SkinFolder:=ExpandConstant('{tmp}')+'\{app}\setup-art';
  StartSkinTimer;
  WizardForm.Color := Paper;
  WizardForm.WelcomePage.Color := Paper;
  WizardForm.FinishedPage.Color := Paper;
  WizardForm.PageNameLabel.Font.Color := Ink;
  WizardForm.PageNameLabel.Font.Size := 13;
  WizardForm.PageNameLabel.Top := ScaleY(10);
  WizardForm.PageNameLabel.Height := ScaleY(24);
  WizardForm.PageDescriptionLabel.Top := ScaleY(36);
  WizardForm.PageDescriptionLabel.Height := ScaleY(20);
  WizardForm.PageDescriptionLabel.Font.Color := MutedInk;
  WizardForm.BeveledLabel.Visible := False;
  ExtractTemporaryFile('uninstall-hero.png');
  UninstallArtPath := ExpandConstant('{tmp}\uninstall-hero.png');
  WizardForm.WelcomeLabel1.Visible := False;
  WizardForm.WelcomeLabel2.Visible := False;
  L := WizardForm.WelcomeLabel1.Left;
  W := WizardForm.WelcomePage.ClientWidth - L - ScaleX(24);
  Y := ScaleY(28);
  TextAt(WizardForm, WizardForm.WelcomePage,L,Y,W,ScaleY(22),'WELCOME TO CUPBOX  /  {#AppVersion}',9,MutedInk);
  LabelText := TextAt(WizardForm,WizardForm.WelcomePage,L,Y+ScaleY(34),W,ScaleY(48),'灵感，从这里开始。',25,Ink);
  LabelText.Font.Style := [];
  TextAt(WizardForm,WizardForm.WelcomePage,L,Y+ScaleY(96),W,ScaleY(36),'一个工作台，装下你的对话、创作与日常。',11,MutedInk);
  for I := 0 to 2 do begin
    FeatureButtons[I] := TBitmapButton.Create(WizardForm);
    FeatureButtons[I].Parent := WizardForm.WelcomePage;
    FeatureButtons[I].SetBounds(L+I*(W div 3),Y+ScaleY(150),W div 3-ScaleX(10),ScaleY(140));
    FeatureButtons[I].Stretch:=True;FeatureButtons[I].BackColor:=clNone;FeatureButtons[I].Cursor:=crHand;
    if I=0 then FeatureButtons[I].Caption := '对话与灵感'
    else if I=1 then FeatureButtons[I].Caption := '工具与协作'
    else FeatureButtons[I].Caption := '主题与陪伴';
    FeatureButtons[I].Tag := I;
    FeatureButtons[I].OnClick := @FeatureClick;
  end;
  FeatureTitle := TextAt(WizardForm,WizardForm.WelcomePage,L,Y+ScaleY(310),W,ScaleY(26),'',12,Ink);
  FeatureTitle.Font.Style := [fsBold];
  FeatureDetail := TextAt(WizardForm,WizardForm.WelcomePage,L,Y+ScaleY(348),W,ScaleY(48),'',10,MutedInk);
  TextAt(WizardForm,WizardForm.WelcomePage,L,Y+ScaleY(398),W,ScaleY(22),'本地离线安装   /   已有数据保留   /   无开机自启',9,MutedInk);
  ShowFeature(0);
  WizardForm.FinishedHeadingLabel.Font.Size := 21;
  WizardForm.FinishedHeadingLabel.Font.Color := Ink;
  WizardForm.FinishedLabel.Font.Color := MutedInk;
  StepLabel := TextAt(WizardForm,WizardForm,ScaleX(20),WizardForm.NextButton.Top+ScaleY(6),
    WizardForm.BackButton.Left-ScaleX(30),ScaleY(22),'',9,MutedInk);
  NavNext:=SkinButton(WizardForm,WizardForm,WizardForm.NextButton,WizardForm.ClientWidth-ScaleX(182),WizardForm.ClientHeight-ScaleY(54),ScaleX(154),ScaleY(42),'next','下一步');
  NavBack:=SkinButton(WizardForm,WizardForm,WizardForm.BackButton,WizardForm.ClientWidth-ScaleX(316),WizardForm.ClientHeight-ScaleY(54),ScaleX(124),ScaleY(42),'back','上一步');
  NavCancel:=SkinButton(WizardForm,WizardForm,WizardForm.CancelButton,WizardForm.ClientWidth-ScaleX(430),WizardForm.ClientHeight-ScaleY(54),ScaleX(104),ScaleY(42),'cancel','取消');
  InstallPercent := TextAt(WizardForm,WizardForm.InstallingPage,0,WizardForm.ProgressGauge.Top+ScaleY(40),
    WizardForm.InstallingPage.ClientWidth,ScaleY(30),'正在准备…',18,Ink);
  InstallTip := TextAt(WizardForm,WizardForm.InstallingPage,0,WizardForm.ProgressGauge.Top+ScaleY(92),
    WizardForm.InstallingPage.ClientWidth,ScaleY(100),
    '本地离线安装 · 无需下载额外组件'+#13#10+#13#10+'已有的对话、模型配置和自定义主题会继续保留。',11,MutedInk);
  ExtractTemporaryFile('banner-tools.png');
  ArtAt(WizardForm,WizardForm.SelectDirPage,0,ScaleY(150),WizardForm.SelectDirPage.ClientWidth,ScaleY(120),ExpandConstant('{tmp}\banner-tools.png'));
  LabelText := TextAt(WizardForm,WizardForm.SelectDirPage,ScaleX(18),ScaleY(166),
    WizardForm.SelectDirPage.ClientWidth-ScaleX(220),ScaleY(24),'给程序一个位置，给创作一份安心。',12,Ink);
  LabelText.Font.Style := [fsBold];
  LabelText := TextAt(WizardForm,WizardForm.SelectDirPage,ScaleX(18),ScaleY(204),
    WizardForm.SelectDirPage.ClientWidth-ScaleX(220),ScaleY(50),'数据与程序分开保存。'+#13#10+'升级或卸载时，已有对话与配置会继续保留。',10,MutedInk);
  LabelText := TextAt(WizardForm,WizardForm.SelectDirPage,0,WizardForm.SelectDirPage.ClientHeight-ScaleY(70),
    WizardForm.SelectDirPage.ClientWidth,ScaleY(40),'数据目录（不会随安装位置移动）'+#13#10+DataFolder,9,MutedInk);
  WizardForm.DiskSpaceLabel.Top := WizardForm.SelectDirPage.ClientHeight-ScaleY(24);
  WizardForm.DiskSpaceLabel.Height := ScaleY(20);
  WizardForm.TasksList.Height := ScaleY(130);
  ExtractTemporaryFile('banner-style.png');
  ArtAt(WizardForm,WizardForm.SelectTasksPage,0,ScaleY(180),WizardForm.SelectTasksPage.ClientWidth,ScaleY(120),ExpandConstant('{tmp}\banner-style.png'));
  LabelText := TextAt(WizardForm,WizardForm.SelectTasksPage,ScaleX(18),ScaleY(198),
    WizardForm.SelectTasksPage.ClientWidth-ScaleX(220),ScaleY(30),'入口由你决定，风格留待慢慢挑。',12,Ink);
  LabelText.Font.Style := [fsBold];
  TextAt(WizardForm,WizardForm.SelectTasksPage,ScaleX(18),ScaleY(240),
    WizardForm.SelectTasksPage.ClientWidth-ScaleX(220),ScaleY(46),'不添加开机自启，也不强制立即运行。'+#13#10+'主题、音乐和筑梦喵衣橱都在应用设置里。',10,MutedInk);
  WizardForm.ReadyMemo.Font.Size := 10;
  SendMessage(WizardForm.Handle,$0127,$00010001,0);
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  LayoutWizardFooter;
  WizardForm.BeveledLabel.Visible := False;
  if CurPageID = wpWelcome then begin
    StepLabel.Caption := '01 / 04    初次见面 · 离线安装';
    WizardForm.NextButton.Caption := '开始设置';
  end else if CurPageID = wpSelectDir then StepLabel.Caption := '02 / 04    安装位置'
  else if CurPageID = wpSelectTasks then StepLabel.Caption := '03 / 04    快捷入口'
  else if CurPageID = wpReady then begin
    StepLabel.Caption := '04 / 04    确认安装';
    if FileExists(ExpandConstant('{app}\{#Exe}')) then WizardForm.NextButton.Caption := '更新并保留数据';
  end else if CurPageID = wpInstalling then StepLabel.Caption := '正在布置工作台 · 请稍候'
  else if CurPageID = wpFinished then StepLabel.Caption := 'CUPBOX    欢迎回到灵感里。'
  else StepLabel.Caption := 'CUPBOX  /  {#AppVersion}';
  ChangeSkin(NavNext,'next','下一步');
  if CurPageID=wpWelcome then ChangeSkin(NavNext,'start','开始设置')
  else if CurPageID=wpReady then begin
    if FileExists(ExpandConstant('{app}\{#Exe}')) then ChangeSkin(NavNext,'update','更新并保留数据')
    else ChangeSkin(NavNext,'install','开始安装');
  end else if CurPageID=wpFinished then ChangeSkin(NavNext,'finish','完成');
  WizardForm.NextButton.Left:=-ScaleX(2000);WizardForm.BackButton.Left:=-ScaleX(2000);WizardForm.CancelButton.Left:=-ScaleX(2000);
  NavNext.Visible:=WizardForm.NextButton.Visible;NavBack.Visible:=WizardForm.BackButton.Visible;NavCancel.Visible:=WizardForm.CancelButton.Visible;
end;

procedure CurInstallProgressChanged(CurProgress, MaxProgress: Integer);
var Percent: Integer;
begin
  if MaxProgress > 0 then begin
    Percent := Round(100.0 * CurProgress / MaxProgress);
    InstallPercent.Caption := IntToStr(Percent) + '%  ·  正在安放你的灵感';
    if Percent >= 90 then InstallTip.Caption := '快好了，正在完成程序注册与快捷入口。'+#13#10+#13#10+'安装结束后，你可以选择是否立即打开 Cupbox。';
  end;
end;

function UpdateReadyMemo(Space, NewLine, MemoUserInfoInfo, MemoDirInfo, MemoTypeInfo,
  MemoComponentsInfo, MemoGroupInfo, MemoTasksInfo: String): String;
begin
  Result := '应用版本  {#AppVersion}' + NewLine + NewLine + MemoDirInfo + NewLine + NewLine +
    '保留的数据目录：' + NewLine + Space + DataFolder + NewLine + NewLine +
    '安装不会清空已有的对话、配置、表情包和记忆。' + NewLine +
    '不会自动添加开机自启；模型与机器人服务在应用内单独设置。';
  if MemoTasksInfo <> '' then Result := Result + NewLine + NewLine + MemoTasksInfo;
end;

function ConfirmCard(Heading, Detail, Action, Footnote: String; Danger: Boolean): Boolean;
var Form: TSetupForm; LabelText: TNewStaticText;
  Primary, Secondary, Folder: TNewButton; Art: TBitmapImage;
  L,W,ButtonY,ArtWidth,SavedCount: Integer; SkinPrimary,SkinSecondary,SkinFolderButton: TBitmapButton; ActionKey: String;
begin
  Form := CreateCustomForm(ScaleX(740),ScaleY(420),True,True);
  SavedCount:=SkinCount;
  try
    Form.Caption := 'Cupbox · ' + Heading;
    Form.Width:=ScaleX(740)+(Form.Width-Form.ClientWidth);
    Form.Height:=ScaleY(420)+(Form.Height-Form.ClientHeight);
    Form.Color := Paper;
    ArtWidth := Form.ClientHeight * 656 div 1256;
    L := ArtWidth + ScaleX(24); W := Form.ClientWidth-L-ScaleX(24);
    ButtonY := Form.ClientHeight-ScaleY(56);
    Art := ArtAt(Form,Form,0,0,ArtWidth,Form.ClientHeight,UninstallArtPath);
    if Action='退出安装' then TextAt(Form,Form,L,ScaleY(24),W,ScaleY(24),'CUPBOX  /  {#AppVersion}',10,MutedInk)
    else if Danger then ArtAt(Form,Form,L,ScaleY(24),W,ScaleY(28),SkinFolder+'\skin-uninstall-confirm.png')
    else ArtAt(Form,Form,L,ScaleY(24),W,ScaleY(28),SkinFolder+'\skin-uninstall-done.png');
    LabelText := TextAt(Form,Form,L,ScaleY(68),W,ScaleY(36),Heading,20,Ink);
    TextAt(Form,Form,L,ScaleY(116),W,ScaleY(54),Detail,10,MutedInk);
    ArtAt(Form,Form,L,ScaleY(188),W,ScaleY(104),SkinFolder+'\skin-data.png');
    LabelText := TextAt(Form,Form,L+ScaleX(60),ScaleY(202),W-ScaleX(76),ScaleY(24),'你的创作会留下来',11,Ink);
    LabelText.Font.Style := [fsBold];
    TextAt(Form,Form,L+ScaleX(60),ScaleY(236),W-ScaleX(76),ScaleY(48),
      '对话 · 模型配置 · 表情包 · 记忆 · 自定义资源'+#13#10+DataFolder,9,MutedInk);
    Folder := TNewButton.Create(Form);Folder.Parent := Form;
    Folder.SetBounds(L,ButtonY-ScaleY(45),ScaleX(136),ScaleY(28));
    Folder.Caption := '查看保留的数据';Folder.Enabled := DirExists(DataFolder);Folder.OnClick := @OpenDataFolder;
    SkinFolderButton:=SkinButton(Form,Form,Folder,L,ButtonY-ScaleY(52),ScaleX(150),ScaleY(38),'folder','查看数据目录');
    Primary := TNewButton.Create(Form);Primary.Parent := Form;
    Primary.SetBounds(Form.ClientWidth-ScaleX(164),ButtonY,ScaleX(140),ScaleY(32));
    Primary.Caption := Action;Primary.ModalResult := mrOk;
    ActionKey:='finish';if Action='退出安装' then ActionKey:='exit' else if Danger then ActionKey:='remove';
    SkinPrimary:=SkinButton(Form,Form,Primary,Form.ClientWidth-ScaleX(164),ButtonY-ScaleY(4),ScaleX(140),ScaleY(42),ActionKey,Action);
    if Danger then begin
      Secondary := TNewButton.Create(Form);Secondary.Parent := Form;
      Secondary.SetBounds(Primary.Left-ScaleX(130),ButtonY,ScaleX(118),ScaleY(32));
      if Action = '退出安装' then Secondary.Caption := '继续安装'
      else Secondary.Caption := '先留下来';
      Secondary.ModalResult := mrCancel;
      Secondary.Default := True;Secondary.Cancel := True;
      ActionKey:='leave';if Action='退出安装' then ActionKey:='continue';
      SkinSecondary:=SkinButton(Form,Form,Secondary,SkinPrimary.Left-ScaleX(130),ButtonY-ScaleY(4),ScaleX(118),ScaleY(42),ActionKey,Secondary.Caption);
      Form.ActiveControl := SkinSecondary;
      TextAt(Form,Form,L,ButtonY,SkinSecondary.Left-L-ScaleX(10),ScaleY(30),Footnote,9,$006A659D);
    end else begin Primary.Default := True;Primary.Cancel := True;Form.ActiveControl := SkinPrimary;end;
    SendMessage(Form.Handle,$0127,$00010001,0);
    Result := Form.ShowModal = mrOk;
  finally SkinCount:=SavedCount;Form.Free;end;
end;

procedure CancelButtonClick(CurPageID: Integer; var Cancel, Confirm: Boolean);
begin
  if WizardSilent or (CurPageID=wpFinished) then Exit;
  Confirm := False;
  Cancel := ConfirmCard('先暂停这次安装？',
    '退出后，本次安装将中止。'+#13#10+'已有的对话、模型配置与记忆不会被清空。',
    '退出安装','你可以随时重新开始',True);
end;

function InitializeUninstall: Boolean;
var Code: Integer; SourceArt, Params: String;
begin
  BrandedUninstall := ExpandConstant('{param:CUPBOXUI|0}') = '1';
  Result := True;
  // A silent worker prevents a second native confirmation after our branded card.
  // Explicit /SILENT and /VERYSILENT calls retain unattended uninstall semantics.
  if not UninstallSilent then begin
    Params := '/SILENT /SUPPRESSMSGBOXES /NORESTART /CUPBOXUI=1';
    if not Exec(ExpandConstant('{uninstallexe}'),Params,'',SW_SHOWNORMAL,ewNoWait,Code) then
      RaiseException('无法启动卸载程序，请稍后重试。');
    Result := False;
    Exit;
  end;
  if not BrandedUninstall then Exit;
  CacheUninstallSkin;
  SourceArt := ExpandConstant('{app}\setup-art\uninstall-hero.png');
  UninstallArtPath := ExpandConstant('{tmp}\cupbox-farewell.png');
  if FileExists(SourceArt) then CopyFile(SourceArt,UninstallArtPath,False);
#ifdef InstallerUIReview
  if (ExpandConstant('{param:CUPBOXREVIEW|}')='progress') or
     (ExpandConstant('{param:CUPBOXREVIEW|}')='layout') then Exit;
#endif
#ifdef InstallerTest
  // Test-build-only preview; never removes any files or registration.
  if ExpandConstant('{param:CUPBOXREVIEW|}') = 'complete' then begin
    ConfirmCard('下次见，筑梦喵在等你。',
      '程序卸载流程已完成，已有对话与配置未被清理。'+#13#10+'若有文件被其他程序占用，可在重启电脑后完成移除。',
      '完成','',False);
    Result := False;
    Exit;
  end;
#endif
  Result := ConfirmCard('暂时告别，灵感留下。',
    '即将卸载 Cupbox 程序及其快捷方式。'+#13#10+'请先停止机器人，并完全退出 Cupbox（包括托盘）。',
    '确认卸载程序','仅移除程序和快捷方式',True);
end;

procedure InitializeUninstallProgressForm;
var Art: TBitmapImage; L,W,ArtWidth,DataTop: Integer; LabelText: TNewStaticText;
begin
  if not BrandedUninstall then Exit;
  UninstallProgressForm.Width:=ScaleX(740)+(UninstallProgressForm.Width-UninstallProgressForm.ClientWidth);
  UninstallProgressForm.Height:=ScaleY(420)+(UninstallProgressForm.Height-UninstallProgressForm.ClientHeight);
  UninstallProgressForm.Color := Paper;
  UninstallProgressForm.OuterNotebook.Visible:=False;
  UninstallProgressForm.MainPanel.Visible:=False;
  UninstallProgressForm.Bevel.Visible:=False;
  UninstallProgressForm.Bevel1.Visible:=False;
  UninstallProgressForm.BeveledLabel.Visible:=False;
  UninstallProgressForm.CancelButton.Visible:=False;
  ArtWidth:=UninstallProgressForm.ClientHeight*656 div 1256;
  L:=ArtWidth+ScaleX(24);W:=UninstallProgressForm.ClientWidth-L-ScaleX(24);
  Art:=ArtAt(UninstallProgressForm,UninstallProgressForm,0,0,ArtWidth,UninstallProgressForm.ClientHeight,UninstallArtPath);
  ArtAt(UninstallProgressForm,UninstallProgressForm,L,ScaleY(24),W,ScaleY(28),SkinFolder+'\skin-uninstall-progress.png');
  TextAt(UninstallProgressForm,UninstallProgressForm,L,ScaleY(68),W,ScaleY(36),'正在收好工作台',20,Ink);
  TextAt(UninstallProgressForm,UninstallProgressForm,L,ScaleY(116),W,ScaleY(32),'只移除程序与快捷方式。你的创作，仍留在本机。',10,MutedInk);
  ArtAt(UninstallProgressForm,UninstallProgressForm,L,ScaleY(164),W,ScaleY(100),SkinFolder+'\skin-progress-card.png');
  UninstallProgressForm.StatusLabel.Parent:=UninstallProgressForm;
  UninstallProgressForm.StatusLabel.AutoSize:=False;
  UninstallProgressForm.StatusLabel.WordWrap:=True;
  UninstallProgressForm.StatusLabel.SetBounds(L+ScaleX(20),ScaleY(180),W-ScaleX(100),ScaleY(28));
  UninstallProgressForm.StatusLabel.Font.Size:=10;
  // Keep the engine-owned progress control alive, but paint its actual value
  // in the rounded track. No elapsed-time progress or blocking close button.
  UninstallProgressForm.ProgressBar.Parent:=UninstallProgressForm;
  UninstallProgressForm.ProgressBar.Left:=-ScaleX(2000);
  UninstallProgressForm.ProgressBar.Visible:=False;
  ProgressPercent:=TextAt(UninstallProgressForm,UninstallProgressForm,L+W-ScaleX(70),ScaleY(178),ScaleX(56),ScaleY(28),'0%',14,Ink);
  ProgressTrack:=ArtAt(UninstallProgressForm,UninstallProgressForm,L+ScaleX(20),ScaleY(230),W-ScaleX(40),ScaleY(10),SkinFolder+'\skin-progress-track.png');
  ProgressFill:=ArtAt(UninstallProgressForm,UninstallProgressForm,ProgressTrack.Left,ProgressTrack.Top,1,ProgressTrack.Height,SkinFolder+'\skin-progress-fill.png');
  ProgressFill.Visible:=False;LastProgressPercent:=-1;ProgressViewActive:=True;
  DataTop:=ScaleY(282);
  ArtAt(UninstallProgressForm,UninstallProgressForm,L,DataTop,W,ScaleY(88),SkinFolder+'\skin-data.png');
  LabelText:=TextAt(UninstallProgressForm,UninstallProgressForm,L+ScaleX(60),DataTop+ScaleY(14),W-ScaleX(76),ScaleY(24),'你的创作会留下来',11,Ink);LabelText.Font.Style:=[fsBold];
  TextAt(UninstallProgressForm,UninstallProgressForm,L+ScaleX(60),DataTop+ScaleY(46),W-ScaleX(76),ScaleY(34),'对话 · 模型配置 · 表情包 · 记忆',9,MutedInk);
  TextAt(UninstallProgressForm,UninstallProgressForm,L,ScaleY(392),W,ScaleY(20),'请稍候，卸载完成后会自动进入完成页。',9,MutedInk);
  if (ProgressTrack.Left<Art.Left+Art.Width+ScaleX(24)) or
     (Art.Top+Art.Height>UninstallProgressForm.ClientHeight) or
     (ProgressTrack.Top+ProgressTrack.Height>DataTop-ScaleY(16)) then
    RaiseException('卸载进度页布局校验失败。');
  Log(Format('CUPBOX_UNINSTALL_LAYOUT pageHeight=%d progressLeft=%d progressTop=%d progressWidth=%d progressHeight=%d artLeft=%d artTop=%d artWidth=%d artHeight=%d textTop=%d', [UninstallProgressForm.ClientHeight,ProgressTrack.Left,ProgressTrack.Top,ProgressTrack.Width,ProgressTrack.Height,Art.Left,Art.Top,Art.Width,Art.Height,DataTop]));
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
begin
  if CurUninstallStep=usPostUninstall then ProgressViewActive:=False;
#ifdef InstallerUIReview
  if ExpandConstant('{param:CUPBOXREVIEW|}')='layout' then Exit;
  // Isolated fixture only: keep the actual progress form visible for capture.
  if BrandedUninstall and (CurUninstallStep=usUninstall) and
     (ExpandConstant('{param:CUPBOXREVIEW|}')='progress') then Sleep(45000);
#endif
  if BrandedUninstall and (CurUninstallStep=usPostUninstall) then
    ConfirmCard('下次见，筑梦喵在等你。',
      '程序卸载流程已完成，已有对话与配置未被清理。'+#13#10+'若有文件被其他程序占用，可在重启电脑后完成移除。',
      '完成','',False);
end;

procedure DeinitializeSetup;
begin
  if SkinTimer<>0 then SkinKillTimer(0,SkinTimer);
  SkinTimer:=0;SkinCount:=0;
end;

procedure DeinitializeUninstall;
begin
  if SkinTimer<>0 then SkinKillTimer(0,SkinTimer);
  SkinTimer:=0;SkinCount:=0;
end;
