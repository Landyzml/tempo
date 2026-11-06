import { useEffect, useRef, useState } from "react";
import { X, Download, Upload, ShieldCheck } from "lucide-react";
import { exportBackup, importBackup, parseBackup } from "./storage";
export function BackupPanel({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null),
    file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function download() {
    setBusy(true);
    try {
      const text = await exportBackup();
      const url = URL.createObjectURL(
        new Blob([text], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `tempo-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMessage("备份已生成，请妥善保存下载的 JSON 文件。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }
  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      if (f.size > 10 * 1024 * 1024) throw Error("备份文件不能超过 10 MB");
      const text = await f.text(),
        rows = parseBackup(text);
      if (
        !confirm(
          `备份包含 ${rows.length} 条记录。导入只添加新记录，相同 ID 保留本机版本，不会覆盖或删除当前数据。继续？`,
        )
      )
        return;
      const result = await importBackup(text);
      setMessage(
        `导入完成：新增 ${result.added} 条，保留本机已有 ${result.skipped} 条。`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "导入失败");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }
  async function persist() {
    if (!navigator.storage?.persist) {
      setMessage("此浏览器不支持持久存储请求，请定期导出备份。");
      return;
    }
    const allowed = await navigator.storage.persist().catch(() => false);
    setMessage(
      allowed
        ? "浏览器已允许持久存储。主动清理网站数据仍会删除记录，请保留备份。"
        : "浏览器未批准持久存储。正常使用仍可保存，请定期导出备份。",
    );
  }
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === dialog.current) onClose();
      }}
    >
      <div className="backup-panel">
        <div className="modal-heading">
          <h2>本机数据与备份</h2>
          <button aria-label="关闭备份" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <p>
          任务和日程保存在当前浏览器，不会上传到
          GitHub，也不会自动同步到其他设备。
        </p>
        <div className="backup-actions">
          <button className="primary" disabled={busy} onClick={download}>
            <Download size={16} />
            导出备份
          </button>
          <button
            className="outline"
            disabled={busy}
            onClick={() => file.current?.click()}
          >
            <Upload size={16} />
            导入备份
          </button>
        </div>
        <input
          ref={file}
          type="file"
          accept=".json,application/json"
          aria-label="选择 Tempo 备份文件"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <small>
          导入会合并新记录；相同 ID 保留本机版本。需要转移设备时，请导出 JSON
          后在另一台设备导入。
        </small>
        <button className="persist-button" onClick={persist}>
          <ShieldCheck size={16} />
          请求浏览器持久保存
        </button>
        <p className="backup-note">
          清除网站数据、删除浏览器配置或使用隐私模式可能导致数据丢失。请定期导出备份，尤其是在更换浏览器前。
        </p>
        {message && (
          <p className="auth-feedback" role="status">
            {message}
          </p>
        )}
      </div>
    </dialog>
  );
}
