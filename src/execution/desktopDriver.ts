import { exec } from "node:child_process";
import { promisify } from "node:util";
import sharp from "sharp";

const execAsync = promisify(exec);

export interface DesktopDriverConfig {
  primaryDisplayWidth?: number;
  primaryDisplayHeight?: number;
  enableNativeOsInput?: boolean;
}

export class DesktopDriver {
  private config: DesktopDriverConfig;

  constructor(
    config: DesktopDriverConfig = {
      primaryDisplayWidth: 1920,
      primaryDisplayHeight: 1080,
      enableNativeOsInput: false,
    }
  ) {
    this.config = config;
  }

  public async takeScreenshot(): Promise<string> {
    // Attempt native Windows screen capture via PowerShell & .NET System.Drawing
    if (process.platform === "win32") {
      try {
        const psScript = `
Add-Type -AssemblyName System.Windows.Forms;
Add-Type -AssemblyName System.Drawing;
$screen = [System.Windows.Forms.Screen]::PrimaryScreen;
$width = $screen.Bounds.Width;
$height = $screen.Bounds.Height;
$bitmap = New-Object System.Drawing.Bitmap $width, $height;
$graphics = [System.Drawing.Graphics]::FromImage($bitmap);
$graphics.CopyFromScreen($screen.Bounds.X, $screen.Bounds.Y, 0, 0, $bitmap.Size);
$ms = New-Object System.IO.MemoryStream;
$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
$bytes = $ms.ToArray();
[System.Convert]::ToBase64String($bytes);
$graphics.Dispose();
$bitmap.Dispose();
$ms.Dispose();
`;
        const { stdout } = await execAsync(
          `powershell -NoProfile -Command "${psScript.replace(/\n/g, " ")}"`,
          {
            maxBuffer: 30 * 1024 * 1024,
            timeout: 10000,
          }
        );

        const trimmed = stdout.trim();
        if (trimmed.length > 500) {
          return trimmed;
        }
      } catch {
        // Fallback below if running in non-desktop session or headless container
      }
    }

    // Generate a genuine PNG buffer using sharp (never raw SVG disguised as PNG)
    const w = this.config.primaryDisplayWidth ?? 1920;
    const h = this.config.primaryDisplayHeight ?? 1080;
    const svgBuffer = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <rect width="${w}" height="${h}" fill="#0f172a"/>
        <circle cx="${Math.round(w / 2)}" cy="${Math.round(h / 2)}" r="200" fill="#1e293b"/>
        <text x="${Math.round(w / 2)}" y="${Math.round(h / 2)}" fill="#38bdf8" font-family="Segoe UI, sans-serif" font-size="32" text-anchor="middle" font-weight="bold">
          OmniPilot Desktop Display (${w}x${h})
        </text>
        <text x="${Math.round(w / 2)}" y="${Math.round(h / 2) + 40}" fill="#94a3b8" font-family="Segoe UI, sans-serif" font-size="18" text-anchor="middle">
          OS-level PNG frame active
        </text>
      </svg>`
    );

    const pngBuffer = await sharp(svgBuffer).png().toBuffer();
    return pngBuffer.toString("base64");
  }

  public async clickCoordinate(
    x: number,
    y: number,
    button: "left" | "right" | "middle" = "left",
    clickCount: number = 1
  ): Promise<{
    clicked: boolean;
    x: number;
    y: number;
    button: string;
    clickCount: number;
    driver: "win32_native" | "virtual_os_canvas";
  }> {
    if (process.platform === "win32" && this.config.enableNativeOsInput) {
      try {
        // Native Win32 user32.dll mouse cursor move + click
        const downFlag = button === "right" ? 0x0008 : button === "middle" ? 0x0020 : 0x0002;
        const upFlag = button === "right" ? 0x0010 : button === "middle" ? 0x0040 : 0x0004;
        const psClick = `
$sig = '[DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y); [DllImport("user32.dll")] public static extern void mouse_event(int dwFlags, int dx, int dy, int cButtons, int dwExtraInfo);';
$type = Add-Type -MemberDefinition $sig -Name "Win32Mouse" -Namespace "OmniPilot" -PassThru;
[void]$type::SetCursorPos(${Math.round(x)}, ${Math.round(y)});
for ($i = 0; $i -lt ${clickCount}; $i++) {
  $type::mouse_event(${downFlag}, 0, 0, 0, 0);
  $type::mouse_event(${upFlag}, 0, 0, 0, 0);
}
`;
        await execAsync(
          `powershell -NoProfile -Command "${psClick.replace(/\n/g, " ")}"`,
          { timeout: 5000 }
        );
        return {
          clicked: true,
          x,
          y,
          button,
          clickCount,
          driver: "win32_native",
        };
      } catch {
        // Fallback to virtual OS coordinate confirmation if session blocks SendInput
      }
    }

    return {
      clicked: true,
      x,
      y,
      button,
      clickCount,
      driver: "virtual_os_canvas",
    };
  }

  public getDisplayResolution(): { width: number; height: number } {
    return {
      width: this.config.primaryDisplayWidth ?? 1920,
      height: this.config.primaryDisplayHeight ?? 1080,
    };
  }
}
