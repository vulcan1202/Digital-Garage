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
  value: string; // YYYY-MM-DD
  onChange: (dateStr: string) => void;
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

function parseDateStr(str?: string): { year: number; month: number; day: number } {
  if (str && /^\d{4}-\d{2}-\d{2}$/.test(str.trim())) {
    const [y, m, d] = str.trim().split('-').map((v) => parseInt(v, 10));
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      return { year: y, month: m, day: d };
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
  maximumDate,
  minimumDate,
  placeholder = 'YYYY-MM-DD (點擊選取日期)',
  disabled = false,
  required = false,
  containerClassName = '',
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // 解析初始值或今日
  const parsed = useMemo(() => parseDateStr(value), [value]);

  // 當前日曆瀏覽的 年 與 月
  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month);

  // 暫存選定之日期
  const [selected, setSelected] = useState<{ year: number; month: number; day: number }>(parsed);

  // 檢視模式：'calendar' 日曆 | 'yearPicker' 年份快選 | 'monthPicker' 月份快選
  const [pickerMode, setPickerMode] = useState<'calendar' | 'yearPicker' | 'monthPicker'>('calendar');

  const openPicker = () => {
    if (disabled) return;
    const current = parseDateStr(value);
    setViewYear(current.year);
    setViewMonth(current.month);
    setSelected(current);
    setPickerMode('calendar');
    setIsOpen(true);
  };

  const closePicker = () => {
    setIsOpen(false);
    setPickerMode('calendar');
  };

  const handleConfirm = () => {
    const formatted = formatDateStr(selected.year, selected.month, selected.day);
    onChange(formatted);
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

  // 檢查某日是否禁用 (超過 maximumDate 或低於 minimumDate)
  const isDateDisabled = useCallback(
    (year: number, month: number, day: number) => {
      const d = new Date(year, month - 1, day);
      if (maximumDate) {
        const max = new Date(maximumDate.getFullYear(), maximumDate.getMonth(), maximumDate.getDate(), 23, 59, 59);
        if (d > max) return true;
      }
      if (minimumDate) {
        const min = new Date(minimumDate.getFullYear(), minimumDate.getMonth(), minimumDate.getDate(), 0, 0, 0);
        if (d < min) return true;
      }
      return false;
    },
    [maximumDate, minimumDate]
  );

  // 當月天數與首日星期
  const { daysInMonth, firstDayOfWeek } = useMemo(() => {
    const days = new Date(viewYear, viewMonth, 0).getDate();
    const firstDay = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0 = Sun
    return { daysInMonth: days, firstDayOfWeek: firstDay };
  }, [viewYear, viewMonth]);

  // 可選年份清單 (自 1980 至 當前年份 + 5 年)
  const yearList = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = 1980;
    const endYear = currentYear + 5;
    const list: number[] = [];
    for (let y = endYear; y >= startYear; y--) {
      list.push(y);
    }
    return list;
  }, []);

  // 格式化目前選定之完整字串以利頂部 Banner 提示
  const selectedBannerText = useMemo(() => {
    const d = new Date(selected.year, selected.month - 1, selected.day);
    const dayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const weekday = dayNames[d.getDay()] || '';
    return `${selected.year} 年 ${padZero(selected.month)} 月 ${padZero(selected.day)} 日 (${weekday})`;
  }, [selected]);

  return (
    <View className={containerClassName}>
      {/* 標籤 Label */}
      <View className="flex-row items-center mb-1.5">
        <Text className="text-xs font-mono text-metal-400">
          {label}
        </Text>
        {required && <Text className="text-racing-red ml-1 text-xs">*</Text>}
      </View>

      {/* 輸入觸發按鈕 Input Trigger */}
      <TouchableOpacity
        onPress={openPicker}
        disabled={disabled}
        activeOpacity={0.7}
        className={`p-3 rounded-xl border flex-row items-center justify-between ${
          disabled ? 'bg-white/[0.02] border-white/5 opacity-50' : 'bg-white/[0.04] border-white/10'
        }`}
      >
        <View className="flex-1 mr-2">
          {value ? (
            <Text className="text-white font-mono text-sm tracking-wide">{value}</Text>
          ) : (
            <Text className="text-metal-500 font-mono text-sm">{placeholder}</Text>
          )}
        </View>
        <Ionicons name="calendar-outline" size={17} color="#06b6d4" />
      </TouchableOpacity>

      {helperText && (
        <Text className="text-[10px] text-metal-500 font-mono mt-1 ml-0.5">{helperText}</Text>
      )}

      {/* 日期選擇彈窗 DatePicker Modal */}
      <Modal
        visible={isOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={closePicker}
      >
        <TouchableWithoutFeedback onPress={closePicker}>
          <View className="flex-1 bg-black/80 justify-center items-center px-4">
            <TouchableWithoutFeedback>
              <View className="w-full max-w-sm bg-[#16181f] border border-white/15 rounded-2xl p-4 shadow-2xl">
                {/* 彈窗標題與關閉按鈕 */}
                <View className="flex-row items-center justify-between pb-3 border-b border-white/10">
                  <View className="flex-row items-center">
                    <Ionicons name="calendar" size={16} color="#06b6d4" />
                    <Text className="text-white font-bold text-sm ml-2 font-mono">
                      {label || '選取日期'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={closePicker}
                    className="p-1 rounded-full bg-white/5"
                  >
                    <Ionicons name="close" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                {/* 當前已選日期顯示 Banner */}
                <View className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-2.5 my-3 items-center">
                  <Text className="text-xs text-metal-400 font-mono">已選取日期</Text>
                  <Text className="text-cyan-400 font-mono font-bold text-base mt-0.5">
                    {selectedBannerText}
                  </Text>
                </View>

                {/* 年月導航列 Navigator */}
                <View className="flex-row items-center justify-between mb-3 px-1">
                  <View className="flex-row items-center gap-1">
                    <TouchableOpacity
                      onPress={() => setViewYear((y) => y - 1)}
                      className="w-7 h-7 rounded-lg bg-white/5 items-center justify-center border border-white/10"
                    >
                      <Ionicons name="play-back" size={12} color="#a1a1aa" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handlePrevMonth}
                      className="w-7 h-7 rounded-lg bg-white/5 items-center justify-center border border-white/10"
                    >
                      <Ionicons name="chevron-back" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>

                  {/* 點擊切換為年份 / 月份快速選取模式 */}
                  <TouchableOpacity
                    onPress={() =>
                      setPickerMode((prev) => (prev === 'calendar' ? 'yearPicker' : 'calendar'))
                    }
                    className="flex-row items-center bg-white/5 px-3 py-1 rounded-lg border border-white/10"
                  >
                    <Text className="text-white font-mono font-bold text-sm mr-1">
                      {`${viewYear} 年 ${viewMonth} 月`}
                    </Text>
                    <Ionicons
                      name={pickerMode === 'calendar' ? 'chevron-down' : 'chevron-up'}
                      size={13}
                      color="#06b6d4"
                    />
                  </TouchableOpacity>

                  <View className="flex-row items-center gap-1">
                    <TouchableOpacity
                      onPress={handleNextMonth}
                      className="w-7 h-7 rounded-lg bg-white/5 items-center justify-center border border-white/10"
                    >
                      <Ionicons name="chevron-forward" size={14} color="#fff" />
                    </TouchableOpacity>
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
                      contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}
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

                {/* 模式 2：月份快速挑選 Grid */}
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
                              setPickerMode('calendar');
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

                {/* 模式 3：標準日曆網格 Calendar Grid */}
                {pickerMode === 'calendar' && (
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
                        <View key={`empty-${i}`} className="w-9 h-9 items-center justify-center my-0.5" />
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
                      <Text className="text-xs font-mono text-cyan-400 font-semibold">今天</Text>
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
