export const CHANNELS={
 napcat:{name:'QQ',method:'NapCat 扫码',badge:'个人账号',description:'个人QQ扫码，保留现有完整互动能力。'},
 official:{name:'QQ 官方机器人',method:'AppID / AppSecret',badge:'官方通道',description:'官方机器人群聊@与单聊，支持文字和图片。'},
 weixin:{name:'微信',method:'个人微信扫码',badge:'扫码连接',description:'腾讯iLink通道，扫码绑定后接收单聊文字。'},
 wecom:{name:'企业微信',method:'智能机器人长连接',badge:'BotID / Secret',description:'企业微信API模式智能机器人，接收单聊与群聊文字。'},
 feishu:{name:'飞书',method:'企业自建应用长连接',badge:'AppID / AppSecret',description:'自建应用开启机器人与消息事件，接收单聊和群内@。'},
 dingtalk:{name:'钉钉',method:'企业内部机器人 Stream',badge:'ClientID / Secret',description:'机器人发布为Stream模式，接收单聊和群内@。'},
};
export const EXTRA_CHANNELS=['weixin','wecom','feishu','dingtalk'];
export const isExtraChannel=key=>EXTRA_CHANNELS.includes(key);
