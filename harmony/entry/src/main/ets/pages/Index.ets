import { webview } from '@kit.ArkWeb';
import { picker } from '@kit.CoreFileKit';
import { BusinessError } from '@kit.BasicServicesKit';

@Entry
@Component
struct Index {
  controller: webview.WebviewController = new webview.WebviewController();

  build() {
    Column() {
      Web({ src: $rawfile('www/index.html'), controller: this.controller })
        .javaScriptAccess(true)          // H5 全靠 JS
        .domStorageAccess(true)          // AI 配置存 localStorage
        .fileAccess(true)                // 读 rawfile 内静态资源
        .onlineImageAccess(true)
        .imageAccess(true)
        .mixedMode(MixedMode.All)        // 允许本地页面请求 https AI 接口
        .overScrollMode(OverScrollMode.NEVER)
        .onPermissionRequest((event: PermissionRequest) => {
          // H5 getUserMedia 摄像头权限 → 交给系统授权
          const perms = event.request.getAccessibleResource();
          const grants: Array<string> = [];
          perms.forEach((p: string) => {
            if (p === 'TYPE_VIDEO_CAPTURE' || p === 'TYPE_AUDIO_CAPTURE') grants.push(p);
          });
          if (grants.length > 0) event.request.grant(grants);
          else event.request.deny();
        })
        .onShowFileSelector((event: OnShowFileSelectorEvent) => {
          // H5 的 <input type="file"> → 系统文件选择器
          const options = new picker.DocumentSelectOptions();
          options.fileSuffixFilters = ['图片(.png, .jpg, .jpeg, .webp)|.png,.jpg,.jpeg,.webp'];
          const docPicker = new picker.DocumentViewPicker(getContext(this));
          docPicker.select(options).then((uris: Array<string>) => {
            event.result.handleFileList(uris);
          }).catch((err: BusinessError) => {
            console.error('文件选择失败: ' + JSON.stringify(err));
            event.result.handleFileList([]);
          });
          return true;
        })
        .width('100%')
        .height('100%')
    }
    .width('100%')
    .height('100%')
  }
}
