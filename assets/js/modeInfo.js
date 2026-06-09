(function () {
  "use strict";

  window.MywebModeInfo = {
    classic: {
      icon: "🌐",
      label: "经典",
      rule: "翻开所有安全格。普通经典模式踩雷失败，每日经典按生命值规则结算。"
    },
    taps: {
      icon: "👆",
      label: "点开",
      rule: "不能插旗，在生命耗尽前翻开目标数量的安全格。"
    },
    treasure_hunt: {
      icon: "💎",
      label: "寻宝",
      rule: "在地雷线索附近寻找隐藏宝藏，找到宝藏即完成目标。"
    },
    detonation: {
      icon: "💥",
      label: "引爆",
      rule: "主动点击地雷完成引爆目标，点击安全格会消耗机会。"
    },
    flags: {
      icon: "🚩",
      label: "插旗",
      rule: "只能插旗，正确标记目标数量的地雷即可完成。"
    }
  };
})();
