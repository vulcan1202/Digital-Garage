import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface DatePickerInputProps {
  label: string;
  value: string; // YYYY-MM-DD 或 YYYY-MM
  onChange: (dateStr: string) => void;
  mode?: 'date' | 'month'; // 預設 'date'；若為 'month' 則僅選取 YYYY-MM
  maximumDate?: Date;
  minimumDate?: Date;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  containerClassName?: string;
  helperText?: string;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

function padZero(n: number): string {
  return n < 10 ? '0' + n : '' + n;
}

function formatDateStr(year: number, month: number, day: number): string {
  return `${year}-${padZero(month)}-${padZero(day)}`;
}

function formatMonthStr(year: number, month: number): string {
  return `${year}-${padZero(month)}`;
}

function parseDateStr(str?: string): { year: number; month: number; day: number } {
  if (str) {
    const trimmed = str.trim();
    // 支援 YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map((v) => parseInt(v, 10));
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        return { year: y, month: m, day: d };
      }
    }
    // 支援 YYYY-MM
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      const [y, m] = trimmed.split('-').map((v) => parseInt(v, 10));
      if (!isNaN(y) && !isNaN(m)) {
        return { year: y, month: m, day: 1 };
      }
    }
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  mode = 'date',
  maximumDate,
  minimumDate,
  placeholder,
  disabled = false,
  required = false,
  containerClassName = '',
  helperText,
}) => {
  const isMonthMode = mode === 'month';
  const defaultPlaceholder = isMonthMode
    ? 'YYYY-MM (點擊選取年月)'
    : 'YYYY-MM-DD (點擊選取日期)';

  const [isOpen, setIsOpen] = useState(false);

  // 解析初始值或今日
  const parsed = useMemo(() => parseDateStr(value), [value]);

  // 當前瀏覽的 年 與 月
  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month);

  // 暫存選定之日期
  const [selected, setSelected] = useState<{ year: number; month: number; day: number }>(parsed);

  // 檢視模式：'calendar' 日曆 | 'yearPicker' 年份快選 | 'monthPicker' 月份快選
  const [pickerMode, setPickerMode] = useState<'calendar' | 'yearPicker' | 'monthPicker'>(
    isMonthMode ? 'monthPicker' : 'calendar'
  );

  const openPicker = () => {
    if (disabled) return;
    const current = parseDateStr(value);
    setViewYear(current.year);
    setViewMonth(current.month);
    setSelected(current);
    setPickerMode(isMonthMode ? 'monthPicker' : 'calendar');
    setIsOpen(true);
  };

  const closePicker = () => {
    setIsOpen(false);
    setPickerMode(isMonthMode ? 'monthPicker' : 'calendar');
  };

  const handleConfirm = () => {
    if (isMonthMode) {
      const formattedMonth = formatMonthStr(viewYear, viewMonth);
      onChange(formattedMonth);
    } else {
      const formattedDate = formatDateStr(selected.year, selected.month, selected.day);
      onChange(formattedDate);
    }
    closePicker();
  };

  const handleClear = () => {
    onChange('');
    closePicker();
  };

  const handleSetToday = () => {
    const now = new Date();
    const today = {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate(),
    };
    setViewYear(today.year);
    setViewMonth(today.month);
    setSelected(today);
  };

  // 年月切換
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // 取得當前 viewYear / viewMonth 的總天數與第 1 天星期
  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth, 0).getDate();
  }, [viewYear, viewMonth]);

  const firstDayOfWeek = useMemo(() => {
    return new Date(viewYear, viewMonth - 1, 1).getDay();
  }, [viewYear, viewMonth]);

  // 判斷日期是否超出邊界限制
  const isDateDisabled = useCallback(
    (y: number, m: number, d: number) => {
      const current = new Date(y, m - 1, d);
      if (maximumDate) {
        const max = new Date(
          maximumDate.getFullYear(),
          maximumDate.getMonth(),
          maximumDate.getDate(),
          23,
          59,
          59
        );
        if (current > max) return true;
      }
      if (minimumDate) {
        const min = new Date(
          minimumDate.getFullYear(),
          minimumDate.getMonth(),
          minimumDate.getDate(),
          0,
          0,
          0
        );
        if (current < min) return true;
      }
      return false;
    },
    [maximumDate, minimumDate]
  );

  // 年份清單（自 1900 年至當前年份 + 5 年）
  const yearList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 1970;
    const endYear = currentYear + 5;
    const list: number[] = [];
    for (let y = endYear; y >= startYear; y--) {
      list.push(y);
    }
    return list;
  }, []);

  return (
    <View className={containerClassName}>
      {/* 標籤 Label */}
      <View className="flex-row items-center justify-between mb-1.5">
        <Text className="text-[11px] font-mono text-metal-400 uppercase tracking-wider">
          {label} {required && <Text className="text-racing-orange">*</Text>}
        </Text>
      </View>

      {/* 輸入框外觀觸控區 Touchable Trigger */}
      <TouchableOpacity
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.7}
        className={`flex-row items-center justify-between bg-zinc-950 border ${
          value ? 'border-cyan-500/50' : 'border-white/10'
        } rounded-xl px-3.5 py-2.5 ${disabled ? 'opacity-40' : ''}`}
      >
        <Text
          className={`font-mono text-sm ${
            value ? 'text-white font-semibold' : 'text-zinc-500'
          }`}
        >
          {value || placeholder || defaultPlaceholder}
        </Text>
        <Ionicons
          name={isMonthMode ? 'calendar-number-outline' : 'calendar-outline'}
          size={18}
          color={value ? '#06b6d4' : '#71717a'}
        />
      </TouchableOpacity>

      {/* 說明文字 Helper Text */}
      {helperText ? (
        <Text className="text-[10px] text-zinc-500 font-mono mt-1 px-1">
          {helperText}
        </Text>
      ) : null}

      {/* 日期/年月選擇彈窗 Modal */}
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={closePicker}>
        <TouchableWithoutFeedback onPress={closePicker}>
          <View className="flex-1 justify-center items-center bg-black/75 px-4">
            <TouchableWithoutFeedback>
              <View className="w-full max-w-[340px] bg-metal-900 border border-white/15 rounded-2xl p-4 shadow-2xl">
                {/* 頂部標題列 Header */}
                <View className="flex-row items-center justify-between pb-3 mb-2 border-b border-white/10">
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      name={isMonthMode ? 'calendar-number' : 'calendar'}
                      size={18}
                      color="#06b6d4"
                    />
                    <Text className="text-sm font-mono font-bold text-white tracking-wide">
                      {isMonthMode ? '選取年月 MONTH PICKER' : '選取日期 DATE PICKER'}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closePicker} className="p-1">
                    <Ionicons name="close" size={20} color="#a1a1aa" />
                  </TouchableOpacity>
                </View>

                {/* 年月切換控制器 Month/Year Navigator */}
                <View className="flex-row items-center justify-between mb-3 px-1">
                  <View className="flex-row items-center gap-1">
                    <TouchableOpacity
                      onPress={() => setViewYear((y) => y - 1)}
                      className="w-7 h-7 rounded-lg bg-white/5 items-center justify-center border border-white/10"
                    >
                      <Ionicons name="play-back" size={12} color="#a1a1aa" />
                    </TouchableOpacity>
                    {!isMonthMode && (
                      <TouchableOpacity
                        onPress={handlePrevMonth}
                        className="w-7 h-7 rounded-lg bg-white/5 items-center justify-center border border-white/10"
                      >
                        <Ionicons name="chevron-back" size={14} color="#fff" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* 點擊切換為年份 / 月份快速選取模式 */}
                  <TouchableOpacity
                    onPress={() => {
                      if (isMonthMode) {
                        setPickerMode((prev) => (prev === 'yearPicker' ? 'monthPicker' : 'yearPicker'));
                      } else {
                        setPickerMode((prev) => (prev === 'calendar' ? 'yearPicker' : 'calendar'));
                      }
                    }}
                    className="flex-row items-center bg-white/5 px-3 py-1 rounded-lg border border-white/10"
                  >
                    <Text className="text-white font-mono font-bold text-sm mr-1">
                      {isMonthMode ? `${viewYear} 年 ${viewMonth} 月` : `${viewYear} 年 ${viewMonth} 月`}
                    </Text>
                    <Ionicons
                      name={
                        isMonthMode
                          ? pickerMode === 'yearPicker'
                            ? 'chevron-up'
                            : 'chevron-down'
                          : pickerMode === 'calendar'
                          ? 'chevron-down'
                          : 'chevron-up'
                      }
                      size={13}
                      color="#06b6d4"
                    />
                  </TouchableOpacity>

                  <View className="flex-row items-center gap-1">
                    {!isMonthMode && (
                      <TouchableOpacity
                        onPress={handleNextMonth}
                        className="w-7 h-7 rounded-lg bg-white/5 items-center justify-center border border-white/10"
                      >
                        <Ionicons name="chevron-forward" size={14} color="#fff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => setViewYear((y) => y + 1)}
                      className="w-7 h-7 rounded-lg bg-white/5 items-center justify-center border border-white/10"
                    >
                      <Ionicons name="play-forward" size={12} color="#a1a1aa" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 模式 1：年份快速挑選 Grid */}
                {pickerMode === 'yearPicker' && (
                  <View className="h-56">
                    <Text className="text-metal-400 font-mono text-[11px] mb-2 text-center">
                      選擇西元年份
                    </Text>
                    <ScrollView
                      showsVerticalScrollIndicator={true}
                      contentContainerStyle={{
                        flexDirection: 'row',
                        flexWrap: 'wrap',
                        gap: 6,
                        justifyContent: 'center',
                      }}
                    >
                      {yearList.map((y) => {
                        const isCurrent = y === viewYear;
                        return (
                          <TouchableOpacity
                            key={y}
                            onPress={() => {
                              setViewYear(y);
                              setPickerMode('monthPicker');
                            }}
                            className={`w-[68px] py-2 rounded-lg items-center border ${
                              isCurrent
                                ? 'bg-cyan-500 border-cyan-400'
                                : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <Text
                              className={`font-mono text-xs font-semibold ${
                                isCurrent ? 'text-black font-bold' : 'text-white'
                              }`}
                            >
                              {y}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}

                {/* 模式 2：月份快速挑選 Grid (3 x 4 矩陣) */}
                {pickerMode === 'monthPicker' && (
                  <View className="h-56 justify-center">
                    <Text className="text-metal-400 font-mono text-[11px] mb-3 text-center">
                      選擇月份 ({`${viewYear} 年`})
                    </Text>
                    <View className="flex-row flex-wrap gap-2 justify-center">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => {
                        const isCurrent = m === viewMonth;
                        return (
                          <TouchableOpacity
                            key={m}
                            onPress={() => {
                              setViewMonth(m);
                              setSelected((prev) => ({ ...prev, year: viewYear, month: m }));
                              if (!isMonthMode) {
                                setPickerMode('calendar');
                              }
                            }}
                            className={`w-[76px] py-3 rounded-lg items-center border ${
                              isCurrent
                                ? 'bg-cyan-500 border-cyan-400'
                                : 'bg-white/5 border-white/10'
                            }`}
                          >
                            <Text
                              className={`font-mono text-xs font-semibold ${
                                isCurrent ? 'text-black font-bold' : 'text-white'
                              }`}
                            >
                              {m} 月
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 模式 3：標準日曆網格 Calendar Grid (僅在 date 模式下顯示) */}
                {pickerMode === 'calendar' && !isMonthMode && (
                  <View>
                    {/* 星期標頭 */}
                    <View className="flex-row justify-between mb-1 pb-1 border-b border-white/5">
                      {WEEKDAYS.map((w, idx) => (
                        <View key={w} className="w-9 items-center">
                          <Text
                            className={`text-[11px] font-mono font-bold ${
                              idx === 0 || idx === 6 ? 'text-racing-orange/80' : 'text-metal-400'
                            }`}
                          >
                            {w}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* 日期單元格 */}
                    <View className="flex-row flex-wrap justify-between">
                      {/* 前置空格 */}
                      {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                        <View
                          key={`empty-${i}`}
                          className="w-9 h-9 items-center justify-center my-0.5"
                        />
                      ))}

                      {/* 當月天數 */}
                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const isSelected =
                          selected.year === viewYear &&
                          selected.month === viewMonth &&
                          selected.day === day;

                        const disabledDay = isDateDisabled(viewYear, viewMonth, day);

                        const now = new Date();
                        const isToday =
                          now.getFullYear() === viewYear &&
                          now.getMonth() + 1 === viewMonth &&
                          now.getDate() === day;

                        return (
                          <TouchableOpacity
                            key={day}
                            disabled={disabledDay}
                            onPress={() => setSelected({ year: viewYear, month: viewMonth, day })}
                            className={`w-9 h-9 items-center justify-center my-0.5 rounded-lg border ${
                              isSelected
                                ? 'bg-cyan-500 border-cyan-400'
                                : isToday
                                ? 'bg-cyan-500/10 border-cyan-500/40'
                                : disabledDay
                                ? 'bg-transparent border-transparent opacity-20'
                                : 'bg-white/[0.03] border-white/5'
                            }`}
                          >
                            <Text
                              className={`text-xs font-mono font-medium ${
                                isSelected
                                  ? 'text-black font-bold'
                                  : isToday
                                  ? 'text-cyan-400 font-bold'
                                  : disabledDay
                                  ? 'text-metal-600'
                                  : 'text-white'
                              }`}
                            >
                              {day}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* 底部功能按鈕 Action Footer */}
                <View className="flex-row items-center justify-between pt-3 mt-3 border-t border-white/10">
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={handleClear}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10"
                    >
                      <Text className="text-xs font-mono text-metal-400">清除</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleSetToday}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30"
                    >
                      <Text className="text-xs font-mono text-cyan-400 font-semibold">
                        {isMonthMode ? '本月' : '今天'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={handleConfirm}
                    className="px-5 py-2 rounded-xl bg-cyan-500 items-center justify-center"
                  >
                    <Text className="text-xs font-mono text-black font-bold">確認</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
};
