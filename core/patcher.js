/**
 * Antigravity-Plus Unified Patcher & Self-Healing Engine
 * Combines Chinese localization injection and transparent proxy deployment.
 */

const fs = require('fs');
const path = require('path');
const child_process = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOCALIZATION_DIR = path.join(REPO_ROOT, 'modules', 'localization');
const PROXY_BIN_DIR = path.join(REPO_ROOT, 'modules', 'proxy', 'bin', 'x64');
const LOCALIZATION_ENGINE = path.join(LOCALIZATION_DIR, 'localization_engine.js');

const PATCH_SIGNATURE = '__ANTIGRAVITY_CHINESE_LOCALIZATION_START__';
const PLUS_META_SIGNATURE = '__ANTIGRAVITY_PLUS_PATCHED__';

/**
 * Automatically detects the Antigravity installation directory.
 */
function detectInstallDir(customDir) {
    if (customDir && fs.existsSync(customDir)) {
        return path.resolve(customDir);
    }

    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA || '';
        const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
        const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

        const candidates = [
            path.join(localAppData, 'Programs', 'antigravity'),
            path.join(localAppData, 'Programs', 'Antigravity'),
            path.join(programFiles, 'Antigravity'),
            path.join(programFilesX86, 'Antigravity')
        ];

        for (const candidate of candidates) {
            if (fs.existsSync(candidate) && (
                fs.existsSync(path.join(candidate, 'Antigravity.exe')) ||
                fs.existsSync(path.join(candidate, 'resources', 'app.asar'))
            )) {
                return candidate;
            }
        }
    } else if (process.platform === 'darwin') {
        const macCandidates = [
            '/Applications/Antigravity.app',
            path.join(process.env.HOME || '', 'Applications', 'Antigravity.app')
        ];
        for (const candidate of macCandidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
    } else {
        const linuxCandidates = [
            '/usr/lib/antigravity',
            '/opt/antigravity',
            path.join(process.env.HOME || '', '.local', 'share', 'antigravity')
        ];
        for (const candidate of linuxCandidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
    }

    return null;
}

/**
 * Resolves the resources directory inside the install directory.
 */
function getResourcesDir(installDir) {
    if (!installDir) return null;
    if (process.platform === 'darwin') {
        const macRes = path.join(installDir, 'Contents', 'Resources');
        if (fs.existsSync(macRes)) return macRes;
    }
    const res = path.join(installDir, 'resources');
    if (fs.existsSync(res)) return res;
    if (fs.existsSync(path.join(installDir, 'app.asar'))) return installDir;
    return null;
}

/**
 * Inspects the current state of Antigravity:
 * checks if asar is patched, if proxy dll is deployed, and if config.json exists.
 */
function checkStatus(customDir) {
    const installDir = detectInstallDir(customDir);
    if (!installDir) {
        return {
            isInstalled: false,
            installDir: null,
            resourcesDir: null,
            asarPatched: false,
            proxyDeployed: false,
            configExists: false,
            needsHealing: false,
            platform: process.platform
        };
    }

    const resourcesDir = getResourcesDir(installDir);
    const asarPath = resourcesDir ? path.join(resourcesDir, 'app.asar') : null;
    let asarPatched = false;

    if (asarPath && fs.existsSync(asarPath)) {
        try {
            const buf = fs.readFileSync(asarPath);
            asarPatched = buf.includes(Buffer.from(PATCH_SIGNATURE));
        } catch (e) {
            asarPatched = false;
        }
    }

    let proxyDeployed = false;
    let configExists = false;

    if (process.platform === 'win32') {
        const dllPath = path.join(installDir, 'version.dll');
        const configPath = path.join(installDir, 'config.json');
        proxyDeployed = fs.existsSync(dllPath);
        configExists = fs.existsSync(configPath);
    } else {
        // Transparent DLL proxy injection is specific to Windows
        proxyDeployed = true;
        configExists = true;
    }

    const needsHealing = !asarPatched || !proxyDeployed;

    return {
        isInstalled: true,
        installDir,
        resourcesDir,
        asarPath,
        asarPatched,
        proxyDeployed,
        configExists,
        needsHealing,
        platform: process.platform
    };
}

/**
 * Deploys version.dll and default config.json to the target directory.
 */
function deployProxy(installDir) {
    if (process.platform !== 'win32') {
        console.log('[代理] 非 Windows 平台无需部署 version.dll 劫持代理。');
        return true;
    }

    if (!installDir || !fs.existsSync(installDir)) {
        console.error('[错误] 无法找到有效的 Antigravity 安装目录以部署代理。');
        return false;
    }

    const sourceDll = path.join(PROXY_BIN_DIR, 'version.dll');
    const sourceConfig = path.join(PROXY_BIN_DIR, 'config.json');
    const sourceWeb = path.join(REPO_ROOT, 'modules', 'proxy', 'bin', 'config-web.html');

    const targetDll = path.join(installDir, 'version.dll');
    const targetConfig = path.join(installDir, 'config.json');
    const targetWeb = path.join(installDir, 'config-web.html');

    if (!fs.existsSync(sourceDll)) {
        console.error(`[错误] 缺少代理二进制文件: ${sourceDll}`);
        return false;
    }

    try {
        console.log('[代理] 正在部署 version.dll 到 Antigravity 安装目录...');
        try {
            fs.copyFileSync(sourceDll, targetDll);
            console.log('[代理] version.dll 部署成功！');
        } catch (copyErr) {
            if (copyErr.code === 'EBUSY' && fs.existsSync(targetDll)) {
                console.log('[代理] 检测到 version.dll 当前正被客户端进程加载运行中，保留现有版本。');
            } else {
                throw copyErr;
            }
        }

        if (!fs.existsSync(targetConfig) && fs.existsSync(sourceConfig)) {
            console.log('[代理] 正在部署默认代理配置文件 config.json (默认 SOCKS5 127.0.0.1:7890)...');
            fs.copyFileSync(sourceConfig, targetConfig);
            console.log('[代理] 默认配置文件部署成功！');
        } else if (fs.existsSync(targetConfig)) {
            console.log('[代理] 检测到已存在用户个性化 config.json，严格予以保留，绝不覆盖。');
        }

        if (fs.existsSync(sourceWeb)) {
            fs.copyFileSync(sourceWeb, targetWeb);
        }

        return true;
    } catch (e) {
        console.error(`[错误] 部署代理文件失败: ${e.message}`);
        return false;
    }
}

/**
 * Installs Chinese localization and transparent proxy.
 */
function install(options = {}) {
    const status = checkStatus(options.installDir);
    if (!status.isInstalled) {
        console.error('[错误] 未能检测到 Antigravity 客户端安装路径，请先安装客户端或通过 --install-dir 指定。');
        return false;
    }

    console.log(`[信息] 目标客户端目录: ${status.installDir}`);
    console.log(`[信息] 目标资源目录: ${status.resourcesDir}`);

    // 1. Run localization injection
    console.log('\n>>> 步骤 1/2: 正在注入中文汉化包...');
    const locArgs = [LOCALIZATION_ENGINE];
    if (options.installDir) {
        locArgs.push('--install-dir', options.installDir);
    }
    if (options.noKill) {
        locArgs.push('--no-kill');
    }
    if (options.brandTitle) {
        locArgs.push('--brand-title', options.brandTitle);
    }

    const locResult = child_process.spawnSync(process.execPath, locArgs, {
        cwd: LOCALIZATION_DIR,
        stdio: 'inherit',
        env: process.env
    });

    if (locResult.status !== 0) {
        console.error(`[错误] 汉化注入执行失败 (退出代码: ${locResult.status})`);
        return false;
    }

    // 2. Deploy proxy files (Windows)
    console.log('\n>>> 步骤 2/2: 正在部署免 TUN 强制代理组件...');
    const proxySuccess = deployProxy(status.installDir);
    if (!proxySuccess && process.platform === 'win32') {
        console.warn('[警告] 代理组件部署异常，但汉化已就绪。');
    }

    console.log('\n======================================================');
    console.log('🎉 恭喜！Antigravity-Plus 增强套件（汉化 + 强制代理）部署成功！');
    console.log('======================================================');
    return true;
}

/**
 * Restores original official state.
 */
function restore(options = {}) {
    const status = checkStatus(options.installDir);
    if (!status.isInstalled) {
        console.error('[错误] 未能检测到 Antigravity 客户端安装路径。');
        return false;
    }

    console.log('\n>>> 步骤 1/2: 正在还原官方英文语言包...');
    const locArgs = [LOCALIZATION_ENGINE, '--huifu'];
    if (options.installDir) {
        locArgs.push('--install-dir', options.installDir);
    }
    if (options.noKill) {
        locArgs.push('--no-kill');
    }

    const locResult = child_process.spawnSync(process.execPath, locArgs, {
        cwd: LOCALIZATION_DIR,
        stdio: 'inherit',
        env: process.env
    });

    console.log('\n>>> 步骤 2/2: 正在清理代理组件...');
    if (process.platform === 'win32') {
        const targetDll = path.join(status.installDir, 'version.dll');
        if (fs.existsSync(targetDll)) {
            try {
                fs.unlinkSync(targetDll);
                console.log('[卸载] 已成功移除 version.dll。');
            } catch (e) {
                console.warn(`[提示] 移除 version.dll 失败或文件正被占用: ${e.message}`);
            }
        }
    }

    console.log('\n[√] 官方环境已还原完成！');
    return true;
}

/**
 * Fast self-healing:
 * Runs silently in milliseconds. If needs healing, quietly re-patches without killing or disrupting.
 */
function autoHeal(options = {}) {
    const status = checkStatus(options.installDir);
    if (!status.isInstalled) {
        // App not installed, nothing to heal
        return false;
    }

    if (!status.needsHealing) {
        // Already healthy! No action needed.
        return true;
    }

    console.log('[Antigravity-Plus] 🔄 检测到客户端已更新或补丁缺失，正在执行毫秒级自愈...');
    const success = install({ ...options, noKill: true });
    if (success) {
        console.log('[Antigravity-Plus] ✅ 自愈已完成！');
    } else {
        console.error('[Antigravity-Plus] ❌ 自愈过程中遇到异常。');
    }
    return success;
}

// CLI argument parsing
function main() {
    const args = process.argv.slice(2);
    let action = 'install';
    let customDir = null;
    let noKill = false;
    let brandTitle = 'english';

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === '--status') {
            action = 'status';
        } else if (arg === '--auto-heal') {
            action = 'auto-heal';
        } else if (arg === '--deploy-proxy') {
            action = 'deploy-proxy';
        } else if (arg === '--huifu' || arg === '--uninstall' || arg === '--restore') {
            action = 'restore';
        } else if (arg === '--install') {
            action = 'install';
        } else if (arg === '--no-kill') {
            noKill = true;
        } else if (arg === '--install-dir') {
            customDir = args[i + 1] || null;
            i++;
        } else if (arg.startsWith('--install-dir=')) {
            customDir = arg.split('=')[1];
        } else if (arg === '--brand-title') {
            brandTitle = args[i + 1] || 'english';
            i++;
        }
    }

    if (action === 'status') {
        const status = checkStatus(customDir);
        console.log(JSON.stringify(status, null, 2));
        process.exit(0);
    }

    if (action === 'auto-heal') {
        const ok = autoHeal({ installDir: customDir, noKill: true, brandTitle });
        process.exit(ok ? 0 : 1);
    }

    if (action === 'deploy-proxy') {
        const status = checkStatus(customDir);
        if (!status.isInstalled) {
            console.error('[错误] 找不到安装目录。');
            process.exit(1);
        }
        const ok = deployProxy(status.installDir);
        process.exit(ok ? 0 : 1);
    }

    if (action === 'restore') {
        const ok = restore({ installDir: customDir, noKill, brandTitle });
        process.exit(ok ? 0 : 1);
    }

    // Default: install
    const ok = install({ installDir: customDir, noKill, brandTitle });
    process.exit(ok ? 0 : 1);
}

if (require.main === module) {
    main();
}

module.exports = {
    detectInstallDir,
    getResourcesDir,
    checkStatus,
    deployProxy,
    install,
    restore,
    autoHeal
};
