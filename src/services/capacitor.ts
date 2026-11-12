import { Capacitor } from "@capacitor/core";
import { Share } from "@capacitor/share";
import { Geolocation } from "@capacitor/geolocation";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { App } from "@capacitor/app";
import { Device } from "@capacitor/device";
import { Network } from "@capacitor/network";
import { Browser } from "@capacitor/browser";
import { Clipboard } from "@capacitor/clipboard";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform();

export async function shareWeatherReport(data: {
  title: string;
  text: string;
  url?: string;
}) {
  if (isNative) {
    await Share.share({ title: data.title, text: data.text, url: data.url });
  } else if (navigator.share) {
    await navigator.share(data);
  } else {
    await copyToClipboard(data.url || data.text);
  }
}

export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  if (!isNative) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  try {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== "granted") {
      const req = await Geolocation.requestPermissions();
      if (req.location !== "granted") return null;
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch {
    return null;
  }
}

export async function hapticImpact(style: "light" | "medium" | "heavy" = "medium") {
  if (isNative) {
    const styleMap = { light: ImpactStyle.Light, medium: ImpactStyle.Medium, heavy: ImpactStyle.Heavy };
    await Haptics.impact({ style: styleMap[style] });
  }
}

export async function copyToClipboard(text: string) {
  if (isNative) {
    await Clipboard.write({ string: text });
  } else {
    await navigator.clipboard.writeText(text);
  }
}

export async function openExternalUrl(url: string) {
  if (isNative) {
    await Browser.open({ url, presentationStyle: "popover" });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export async function getAppInfo() {
  if (isNative) {
    const [appInfo, deviceInfo, networkStatus] = await Promise.all([
      App.getInfo(),
      Device.getInfo(),
      Network.getStatus(),
    ]);
    return { appInfo, deviceInfo, networkStatus };
  }
  return {
    appInfo: { name: "Beach Volleyball Hub", version: "0.0.0", build: "web" },
    deviceInfo: { platform: "web", model: navigator.userAgent },
    networkStatus: { connected: navigator.onLine, connectionType: "wifi" },
  };
}

export async function setupPushNotifications() {
  if (!isNative) return;
  
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive === "granted") {
      await PushNotifications.register();
    }
  } catch (error) {
    console.error("Push notifications setup failed:", error);
  }
}

export async function scheduleLocalNotification(data: {
  title: string;
  body: string;
  id: number;
  schedule: { at: Date; repeats?: boolean };
  extra?: Record<string, any>;
}) {
  if (!isNative) return;
  
  try {
    await LocalNotifications.schedule({
      notifications: [{
        id: data.id,
        title: data.title,
        body: data.body,
        schedule: { at: data.schedule.at, repeats: data.schedule.repeats },
        extra: data.extra,
        smallIcon: "ic_stat_icon",
        iconColor: "#D97706",
      }],
    });
  } catch (error) {
    console.error("Local notification schedule failed:", error);
  }
}

export async function takePhoto(): Promise<string | null> {
  if (!isNative) return null;
  
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
    });
    return image.dataUrl || null;
  } catch {
    return null;
  }
}

export async function pickPhoto(): Promise<string | null> {
  if (!isNative) return null;
  
  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Photos,
    });
    return image.dataUrl || null;
  } catch {
    return null;
  }
}

export async function saveFile(fileName: string, data: string, directory: Directory = Directory.Documents) {
  if (!isNative) return;
  
  try {
    await Filesystem.writeFile({
      path: fileName,
      data,
      directory,
      encoding: Encoding.UTF8,
    });
  } catch (error) {
    console.error("Save file failed:", error);
  }
}

export async function readFile(fileName: string, directory: Directory = Directory.Documents): Promise<string | null> {
  if (!isNative) return null;
  
  try {
    const result = await Filesystem.readFile({
      path: fileName,
      directory,
      encoding: Encoding.UTF8,
    });
    return result.data as string;
  } catch {
    return null;
  }
}

export async function setStatusBarStyle(dark: boolean) {
  if (isNative) {
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light });
  }
}

export async function hideSplashScreen() {
  if (isNative) {
    await SplashScreen.hide();
  }
}

// Deep link handling
export function handleDeepLink(url: string) {
  const weatherMatch = url.match(/weather\/([a-zA-Z0-9]+)/);
  if (weatherMatch) {
    return { type: "weather-share", token: weatherMatch[1] };
  }
  return null;
}

// Initialize Capacitor plugins
export async function initializeCapacitor() {
  if (!isNative) return;

  await StatusBar.setOverlaysWebView({ overlay: false });
  await StatusBar.setBackgroundColor({ color: "#FDFBF7" });
  await StatusBar.setStyle({ style: Style.Light });

  setTimeout(() => hideSplashScreen(), 1000);

  await setupPushNotifications();

  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive) {
      window.dispatchEvent(new CustomEvent("bvb-app-foreground"));
    } else {
      window.dispatchEvent(new CustomEvent("bvb-app-background"));
    }
  });

  App.addListener("appUrlOpen", (data) => {
    const parsed = handleDeepLink(data.url);
    if (parsed) {
      window.dispatchEvent(new CustomEvent("bvb-deep-link", { detail: parsed }));
    }
  });

  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push received:", notification);
    window.dispatchEvent(new CustomEvent("bvb-push-received", { detail: notification }));
  });

  PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
    console.log("Push action:", action);
    const parsed = handleDeepLink(action.notification.data?.url || "");
    if (parsed) {
      window.dispatchEvent(new CustomEvent("bvb-deep-link", { detail: parsed }));
    }
  });

  LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
    console.log("Local notification action:", action);
    const extra = action.notification.extra;
    if (extra?.type === "weather-share") {
      window.dispatchEvent(new CustomEvent("bvb-deep-link", { detail: extra }));
    }
  });

  console.log("Capacitor initialized");
}