const getWeekLabels = (startDate) => {
    const weekdays = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"];
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);
        return weekdays[d.getDay() === 0 ? 6 : d.getDay() - 1];
    });
};

const getMonthLabels = (daysInMonth) => {
    const weeks = Math.ceil(daysInMonth / 7);
    return Array.from({ length: weeks }, (_, i) => `Tuần ${i + 1}`);
};

const formatDate = (date) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

const getPeriodTextForWeekOrMonth = (filter, startDate, now) => {
    if (filter === "month") {
        return `${now.toLocaleString("default", { month: "long" })} ${now.getFullYear()}`;
    }
    if (filter === "week") {
        return `${formatDate(startDate)} - ${formatDate(now)}`;
    }
    return "";
};

const getTimeRange = (filter, now = new Date()) => {
    const year = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    let startMonth, endMonth, currentQuarter;

    if (filter === "quarter") {
        currentQuarter = Math.ceil(currentMonth / 3);
        startMonth = (currentQuarter - 1) * 3 + 1;
        endMonth = currentQuarter * 3;
    } else if (filter === "year") {
        startMonth = 1;
        endMonth = currentMonth;
    } else {
        throw new Error("Invalid filter. Use 'quarter' or 'year'.");
    }

    return { year, currentMonth, startMonth, endMonth, currentQuarter };
};

const getPeriodTextForQuarterOrYear = (filter, { year, startMonth, endMonth, currentMonth, currentQuarter }) => {
    if (filter === "quarter") {
        return `Quý ${currentQuarter} / ${year} (T${startMonth} - T${Math.min(endMonth, currentMonth)})`;
    }
    if (filter === "year") {
        return `${year} (T1 - T${currentMonth})`;
    }
    return "";
};

module.exports = {
    getWeekLabels,
    getMonthLabels,
    getPeriodTextForWeekOrMonth,
    formatDate,
    getTimeRange,
    getPeriodTextForQuarterOrYear,
};