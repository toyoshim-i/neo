import { X } from 'lucide-react';
import { ACHIEVEMENT_CATALOG } from '../../lib/db';
import { UserProfile } from '../../types/schema';
import { ChamferedPanel } from '../layout/ChamferedPanel';

interface AchievementsModalProps {
  profile: UserProfile;
  onClose: () => void;
}

export function AchievementsModal({
  profile,
  onClose,
}: AchievementsModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-[#0D0618]/85 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="max-w-xl w-full">
        <ChamferedPanel
          variant="yellow"
          cutSize={12}
          tag="MILESTONES"
          title={`NEURAL ACHIEVEMENTS (${
            profile.unlockedAchievements?.length || 0
          }/${ACHIEVEMENT_CATALOG.length})`}
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
          <div className="p-4 space-y-3 max-h-[75vh] overflow-y-auto font-terminal text-xs">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2.5 bg-[#0D0618] border border-[#00F5D4]/30">
                <div className="text-[10px] text-[#6C7A89]">BASELINE</div>
                <div className="text-sm font-bold text-[#00F5D4]">
                  {profile.baselineWpm ? `${profile.baselineWpm} WPM` : 'UNSET'}
                </div>
              </div>
              <div className="p-2.5 bg-[#0D0618] border border-[#FFE600]/30">
                <div className="text-[10px] text-[#6C7A89]">OVERALL BEST</div>
                <div className="text-sm font-bold text-[#FFE600]">
                  {profile.bestEffectiveWpm} eWPM
                </div>
              </div>
              <div className="p-2.5 bg-[#0D0618] border border-[#FF1E7A]/30">
                <div className="text-[10px] text-[#6C7A89]">
                  PASSAGES MASTERED
                </div>
                <div className="text-sm font-bold text-[#FF1E7A]">
                  {
                    Object.values(profile.passageRecords || {}).filter(
                      (r) => r.stageCompleted >= 3
                    ).length
                  }
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {ACHIEVEMENT_CATALOG.map((ach) => {
                const isUnlocked = Boolean(
                  profile.unlockedAchievements?.includes(ach.id)
                );
                return (
                  <div
                    key={ach.id}
                    className={`p-3 border flex items-start justify-between gap-3 ${
                      isUnlocked
                        ? 'bg-[#FFE600]/10 border-[#FFE600] text-[#F2F5F8]'
                        : 'bg-[#0D0618] border-[#6C7A89]/30 text-[#6C7A89] opacity-65'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] border font-bold ${
                            isUnlocked
                              ? 'border-[#FFE600] bg-[#FFE600] text-[#0D0618]'
                              : 'border-[#6C7A89]/40 bg-[#180B29] text-[#6C7A89]'
                          }`}
                        >
                          {ach.badgeCode}
                        </span>
                        <span
                          className={`font-bold ${
                            isUnlocked ? 'text-[#FFE600]' : 'text-[#6C7A89]'
                          }`}
                        >
                          {ach.title}
                        </span>
                        <span className="text-[10px] text-[#00F5D4]">
                          // {ach.subtitle}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        {ach.description}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {isUnlocked ? (
                        <span className="px-2 py-0.5 bg-[#00F5D4]/20 border border-[#00F5D4] text-[#00F5D4] text-[10px] font-bold">
                          UNLOCKED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-[#180B29] border border-[#6C7A89]/40 text-[#6C7A89] text-[10px]">
                          LOCKED
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ChamferedPanel>
      </div>
    </div>
  );
}
