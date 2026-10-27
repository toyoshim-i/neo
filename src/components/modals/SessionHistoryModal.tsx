import { Download, Upload, X } from 'lucide-react';
import { importDatabaseJson } from '../../lib/db';
import { SessionLog, UserProfile } from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface SessionHistoryModalProps {
  profile: UserProfile;
  sessionHistory: SessionLog[];
  onExportJson: () => void;
  onReloadFromDb: () => Promise<void>;
  onClose: () => void;
}

export function SessionHistoryModal({
  profile,
  sessionHistory,
  onExportJson,
  onReloadFromDb,
  onClose,
}: SessionHistoryModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0D0618]/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <ChamferedPanel
          variant="cyan"
          cutSize={12}
          tag="TELEMETRY"
          title="SESSION HISTORY & DATA BACKUP"
          rightSlot={
            <button
              type="button"
              onClick={onClose}
              className="text-[#6C7A89] hover:text-[#F2F5F8] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          }
        >
          <div className="p-4 space-y-4 font-terminal text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                <div className="text-[10px] text-[#6C7A89]">BEST eWPM</div>
                <div className="text-base font-bold text-[#00F5D4]">
                  {profile.bestEffectiveWpm}
                </div>
              </div>
              <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                <div className="text-[10px] text-[#6C7A89]">WORDS READ</div>
                <div className="text-base font-bold text-[#F2F5F8]">
                  {profile.totalWordsRead}
                </div>
              </div>
              <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                <div className="text-[10px] text-[#6C7A89]">SESSIONS</div>
                <div className="text-base font-bold text-[#FFE600]">
                  {sessionHistory.length}
                </div>
              </div>
            </div>

            <div className="max-h-[45vh] overflow-y-auto space-y-1.5">
              {sessionHistory.length === 0 ? (
                <div className="py-8 text-center text-[#6C7A89]">
                  No sessions recorded yet. Complete a reading session to log
                  telemetry.
                </div>
              ) : (
                sessionHistory.map((s) => (
                  <div
                    key={s.id}
                    className="p-2.5 bg-[#0D0618] border border-[#6C7A89]/30 flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[#00F5D4] font-bold">
                        {s.effectiveWpm} eWPM
                      </span>
                      <span className="text-[#6C7A89] ml-2">
                        ({s.rawWpm} WPM · SYNC {Math.round(s.syncRate * 100)}
                        %)
                      </span>
                    </div>
                    <div className="text-[10px] text-[#6C7A89]">
                      {s.mode.toUpperCase()} ·{' '}
                      {new Date(s.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-[#6C7A89]/20 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onExportJson}
                className="cyber-btn px-3 py-1.5 bg-[#0D0618] border border-[#00F5D4]/60 text-[#00F5D4] flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>EXPORT JSON</span>
              </button>

              <label className="cyber-btn px-3 py-1.5 bg-[#0D0618] border border-[#FFE600]/60 text-[#FFE600] flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>IMPORT JSON</span>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const text = await file.text();
                    await importDatabaseJson(text);
                    await onReloadFromDb();
                  }}
                />
              </label>
            </div>
          </div>
        </ChamferedPanel>
      </div>
    </div>
  );
}
