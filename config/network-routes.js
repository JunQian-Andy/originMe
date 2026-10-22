// 双网卡网段路由配置
//
// 根据前端请求来源 IP 所属网段，选择：
//   - onlyofficeUrl：浏览器加载 OnlyOffice 编辑器脚本的服务地址
//   - callbackHost ：OnlyOffice 容器回调本服务、下载文档用的本服务地址
//
// 新增/修改网段时，按下面结构增减条目即可（cidr 为标准 CIDR 写法）。

module.exports = [
  {
    name: '172.16.166',
    cidr: '172.16.166.0/24',
    onlyofficeUrl: 'http://172.16.166.1:8081',
    callbackHost: 'http://172.16.166.1:3000',
  },
  {
    name: '192.168.71',
    cidr: '192.168.71.0/24',
    onlyofficeUrl: 'http://192.168.71.115:8081',
    callbackHost: 'http://192.168.71.115:3000',
  },
];
