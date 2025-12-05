import * as echarts from 'echarts';
import * as _ from 'lodash';

type RatingDistribution = Record<string, number>;

export type Mission = {
    name: string;
    authors: string[];
    releaseDate: Date;
    game: GAME;
    id: number;
    ratingAverage: number;
    ratingCount: number;
    thumbnailUrl: string;
    genres: string[];
    ratingDistribution: RatingDistribution;
};

export type MissionJson = {
    name: string;
    authors: string[];
    release_date: string;
    game: string;
    id: number;
    rating_average: number;
    rating_count: number;
    thumbnail_url: string;
    genres: string[];
    rating_distribution: RatingDistribution;
};

type MissionData = [Date, number, number, string, string, string, string, number];
type YearRange = { min?: number; max?: number };
type TooltipDatum = echarts.TooltipComponentFormatterCallbackParams & { data?: unknown };

enum DATA_TYPE {
    Marker,
    Line,
    Both
}

class MissionDataField {
    public static readonly releaseDateIdx = 0;
    public static readonly ratingAverageIdx = 1;
    public static readonly ratingCountIdx = 2;
    public static readonly nameIdx = 3;
    public static readonly authorsIdx = 4;
    public static readonly thumbnailIdx = 5;
    public static readonly genresIdx = 6;
    public static readonly idIdx = 7;
}

export class GAME {
    private static AllValues: { [name: string]: GAME } = {};

    public static readonly ALL = new GAME('All Games');
    public static readonly T1 = new GAME('Thief: The Dark Project');
    public static readonly TG = new GAME('Thief Gold');
    public static readonly T2 = new GAME('Thief II: The Metal Age');
    public static readonly T3 = new GAME('Thief: Deadly Shadows');
    public static readonly TDM = new GAME('The Dark Mod');

    private constructor(public readonly name: string) {
        GAME.AllValues[name] = this;
    }

    public static parseEnum(name: string | undefined | null): GAME {
        if (!name) {
            return GAME.ALL;
        }
        return GAME.AllValues[name] ?? GAME.ALL;
    }

    public static getValues(): GAME[] {
        return Object.values(this.AllValues);
    }

    public toString(): string {
        return this.name;
    }
}

const STYLE_ELEMENT_ID = 'tmv-style';

const LAYOUT_TEMPLATE = `
    <div class="tmv-controls">
        <label class="tmv-select">
            Game
            <select data-role="select-game"></select>
        </label>
        <label class="tmv-checkbox">
            <input type="checkbox" data-role="scale-by-ratings" checked /> Scale by rating count
        </label>
        <label class="tmv-checkbox">
            <input type="checkbox" data-role="show-thumbnails" /> Show thumbnails on hover
        </label>
        <div data-role="rating-filter-block">
            <label class="tmv-checkbox">
                <input type="checkbox" data-role="limit-y" /> Limit rating axis
            </label>
            <div class="tmv-range-group">
                <label>
                    Min rating
                    <input type="range" min="1" max="9.5" step="0.5" value="1" data-role="y-bottom" />
                    <output data-role="y-bottom-output">1</output>
                </label>
                <label>
                    Max rating
                    <input type="range" min="1.5" max="10" step="0.5" value="10" data-role="y-top" />
                    <output data-role="y-top-output">10</output>
                </label>
            </div>
        </div>
        <div data-role="year-filter-block">
            <label class="tmv-checkbox">
                <input type="checkbox" data-role="limit-x" /> Limit release year
            </label>
            <div class="tmv-range-group">
                <label>
                    From
                    <input type="range" min="1999" max="2025" step="1" value="1999" data-role="x-left" />
                    <output data-role="x-left-output">1999</output>
                </label>
                <label>
                    To
                    <input type="range" min="1999" max="2025" step="1" value="2025" data-role="x-right" />
                    <output data-role="x-right-output">2025</output>
                </label>
            </div>
        </div>
    </div>
    <div class="tmv-chart" data-role="chart"></div>
`;

const BASE_STYLES = `
    .tmv-root {
        font-family: system-ui, 'Segoe UI', sans-serif;
        color: #111;
        background: #fff;
    }
    .tmv-controls {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
        align-items: center;
        padding: 0.5rem;
        border-bottom: 1px solid #eee;
    }
    .tmv-select select {
        margin-left: 0.5rem;
        padding: 0.15rem 0.35rem;
    }
    .tmv-checkbox {
        display: flex;
        align-items: center;
        gap: 0.35rem;
        font-size: 0.9rem;
    }
    .tmv-range-group {
        display: flex;
        gap: 1rem;
        flex-wrap: wrap;
        font-size: 0.85rem;
    }
    .tmv-range-group label {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
    .tmv-range-group input[type="range"] {
        width: 160px;
    }
    .tmv-chart {
        width: 100%;
        height: 75vh;
    }
    @media (min-width: 992px) {
        .tmv-chart {
            height: 85vh;
        }
    }
`;

interface ControlRefs {
    root: HTMLElement;
    chart: HTMLDivElement;
    selectGame: HTMLSelectElement;
    checkboxScaleByRatings: HTMLInputElement;
    checkboxMissionThumbnails: HTMLInputElement;
    checkboxLimitY: HTMLInputElement;
    yBottom: HTMLInputElement;
    yTop: HTMLInputElement;
    yBottomOutput: HTMLOutputElement;
    yTopOutput: HTMLOutputElement;
    checkboxLimitX: HTMLInputElement;
    xLeft: HTMLInputElement;
    xRight: HTMLInputElement;
    xLeftOutput: HTMLOutputElement;
    xRightOutput: HTMLOutputElement;
    yearFilterBlock: HTMLDivElement;
    ratingFilterBlock: HTMLDivElement;
}

export type InitOptions = {
    root: string | HTMLElement;
    data: Mission[];
    initial?: {
        showThumbnails?: boolean;
        scaleByRatings?: boolean;
    };
    features?: {
        yearFilter?: boolean;
        ratingFilter?: boolean;
        groupedGameOptions?: boolean;
    };
    behavior?: {
        radiusScale?: number;
        minSymbolSize?: number;
        maxSymbolSize?: number;
        releaseYearRange?: {
            min?: number;
            max?: number;
        };
    };
    appearance?: {
        className?: string;
        injectDefaultStyles?: boolean;
        chartTheme?: string;
    };
};

export type ThiefVizHandle = {
    updateData: (missions: Mission[]) => void;
    dispose: () => void;
    getChart: () => echarts.ECharts;
};

type GameFilterOption = {
    id: string;
    label: string;
    predicate: (mission: Mission) => boolean;
};

class ThiefMissionsViz {
    private readonly dom: ControlRefs;
    private readonly resizeHandler: () => void;
    private chart!: echarts.ECharts;
    private missions: Mission[];
    private readonly enableYearFilter: boolean;
    private readonly enableRatingFilter: boolean;
    private readonly groupedGameOptions: boolean;
    private readonly gameFilterOptions: GameFilterOption[];
    private readonly chartTheme?: string;
    private readonly radiusScale: number;
    private readonly minSymbolSize: number;
    private readonly maxSymbolSize: number;
    private readonly configYearRange?: YearRange;

    constructor(private options: InitOptions) {
        const root = resolveRoot(options.root);
        if (options.appearance?.className) {
            root.classList.add(options.appearance.className);
        }
        if (options.appearance?.injectDefaultStyles !== false) {
            injectStyles();
        }
        this.chartTheme = options.appearance?.chartTheme;
        this.enableYearFilter = options.features?.yearFilter !== false;
        this.enableRatingFilter = options.features?.ratingFilter !== false;
        this.groupedGameOptions = options.features?.groupedGameOptions === true;
        this.dom = buildLayout(root);
        this.gameFilterOptions = this.buildGameFilterOptions();
        const scale = options.behavior?.radiusScale;
        this.radiusScale = typeof scale === 'number' && scale > 0 ? scale : 1;
        const minSize = options.behavior?.minSymbolSize;
        const maxSize = options.behavior?.maxSymbolSize;
        this.minSymbolSize = typeof minSize === 'number' && minSize > 0 ? minSize : 4;
        this.maxSymbolSize = typeof maxSize === 'number' && maxSize > 0 ? maxSize : Infinity;
        const yr = options.behavior?.releaseYearRange;
        if (yr && (typeof yr.min === 'number' || typeof yr.max === 'number')) {
            this.configYearRange = {
                min: typeof yr.min === 'number' ? yr.min : undefined,
                max: typeof yr.max === 'number' ? yr.max : undefined,
            };
        }
        if (!options.data || !options.data.length) {
            console.warn('ThiefMissionsViz init called without mission data; chart will render empty state.');
        }
        this.missions = (options.data ?? []).slice();
        this.resizeHandler = () => {
            this.chart?.resize();
        };
        this.configureFeatureVisibility();
    }

    public init(): ThiefVizHandle {
        this.applyInitialValues();
        this.populateGameSelect();
        this.chart = echarts.init(this.dom.chart, this.chartTheme);
        this.chart.setOption({
            tooltip: {
                trigger: 'item',
                formatter: (
                    params:
                        | echarts.TooltipComponentFormatterCallbackParams
                        | echarts.TooltipComponentFormatterCallbackParams[],
                ) => {
                    const datum = Array.isArray(params)
                        ? (params[0] as TooltipDatum)
                        : (params as TooltipDatum);
                    const payload = datum ?? ({} as TooltipDatum);
                    return this.buildTooltip(payload?.data as MissionData);
                },
            },
            xAxis: { type: 'time' },
            yAxis: { type: 'value', min: 1 },
            series: [],
        });
        this.setupEventListeners();
        this.setupChartInteractions();
        this.updateChart();
        window.addEventListener('resize', this.resizeHandler);

        return {
            updateData: (missions) => {
                this.missions = missions.slice();
                this.reconcileYearRanges();
                this.updateChart();
            },
            dispose: () => this.dispose(),
            getChart: () => this.chart,
        };
    }

    private dispose() {
        window.removeEventListener('resize', this.resizeHandler);
        if (this.chart) {
            this.chart.dispose();
        }
    }

    private applyInitialValues() {
        const { initial } = this.options;
        if (initial?.showThumbnails) {
            this.dom.checkboxMissionThumbnails.checked = true;
        }
        if (initial?.scaleByRatings === false) {
            this.dom.checkboxScaleByRatings.checked = false;
        }
        this.syncOutputs();
        this.reconcileYearRanges();
        if (this.enableYearFilter && this.configYearRange) {
            this.applyYearRangeToInputs(this.configYearRange);
            this.dom.checkboxLimitX.checked = true;
        }
    }

    private configureFeatureVisibility() {
        if (!this.enableYearFilter) {
            this.dom.yearFilterBlock.style.display = 'none';
            this.dom.checkboxLimitX.checked = false;
            this.dom.checkboxLimitX.disabled = true;
            this.dom.xLeft.disabled = true;
            this.dom.xRight.disabled = true;
        }
        if (!this.enableRatingFilter) {
            this.dom.ratingFilterBlock.style.display = 'none';
            this.dom.checkboxLimitY.checked = false;
            this.dom.checkboxLimitY.disabled = true;
            this.dom.yBottom.disabled = true;
            this.dom.yTop.disabled = true;
        }
    }

    private populateGameSelect() {
        this.dom.selectGame.innerHTML = '';
        this.gameFilterOptions.forEach((option) => {
            const optionElement = document.createElement('option');
            optionElement.value = option.id;
            optionElement.textContent = option.label;
            this.dom.selectGame.appendChild(optionElement);
        });
        this.dom.selectGame.value = this.gameFilterOptions[0]?.id ?? '';
    }

    private setupEventListeners() {
        this.dom.selectGame.addEventListener('change', () => this.updateChart());
        this.dom.checkboxScaleByRatings.addEventListener('change', () => this.updateChart());
        this.dom.checkboxMissionThumbnails.addEventListener('change', () => {
            this.chart.dispatchAction({ type: 'hideTip' });
        });

        if (this.enableRatingFilter) {
            this.dom.checkboxLimitY.addEventListener('change', () => this.updateChart());
            this.dom.yBottom.addEventListener('input', () => {
                this.dom.checkboxLimitY.checked = true;
                this.syncOutputs();
                this.updateChart();
            });
            this.dom.yTop.addEventListener('input', () => {
                this.dom.checkboxLimitY.checked = true;
                this.syncOutputs();
                this.updateChart();
            });
        }
        if (this.enableYearFilter) {
            this.dom.checkboxLimitX.addEventListener('change', () => this.updateChart());
            this.dom.xLeft.addEventListener('input', () => {
                this.dom.checkboxLimitX.checked = true;
                this.syncOutputs();
                this.updateChart();
            });
            this.dom.xRight.addEventListener('input', () => {
                this.dom.checkboxLimitX.checked = true;
                this.syncOutputs();
                this.updateChart();
            });
        }
    }

    private reconcileYearRanges() {
        if (!this.enableYearFilter) {
            return;
        }
        const [minYear, maxYear] = getYearBounds(this.missions);
        const min = `${minYear}`;
        const max = `${maxYear}`;
        [this.dom.xLeft, this.dom.xRight].forEach((input) => {
            input.min = min;
            input.max = max;
        });
        this.dom.xLeft.value = min;
        this.dom.xRight.value = max;
        this.syncOutputs();
    }

    private updateChart() {
        const selectedFilter = this.gameFilterOptions.find((option) => option.id === this.dom.selectGame.value)
            ?? this.gameFilterOptions[0];
        let filtered = this.missions.slice();
        if (selectedFilter) {
            filtered = filtered.filter(selectedFilter.predicate);
        }
        const yearRange = this.getActiveYearRange();
        if (yearRange) {
            filtered = filtered.filter((mission) => this.isMissionWithinYearRange(mission, yearRange));
        }

        const option: echarts.EChartsOption = {
            series: [
                {
                    type: 'scatter',
                    data: missionsToData(filtered),
                    symbolSize: (params: MissionData) =>
                        this.getSymbolSize(params),
                },
            ],
            yAxis: {
                type: 'value',
                min: this.enableRatingFilter && this.dom.checkboxLimitY.checked
                    ? Number(this.dom.yBottom.value)
                    : 1,
                max: this.enableRatingFilter && this.dom.checkboxLimitY.checked
                    ? Number(this.dom.yTop.value)
                    : undefined,
            },
            xAxis: {
                type: 'time',
                min: yearRange?.min !== undefined ? new Date(`${yearRange.min}-01-01`) : undefined,
                max: yearRange?.max !== undefined ? new Date(`${yearRange.max}-12-31`) : undefined,
            },
        };

        this.chart.setOption(option);
    }

    private buildTooltip(missionData: MissionData) {
        if (!missionData) {
            return '';
        }

        const formattedDate = formatReleaseDate(missionData[MissionDataField.releaseDateIdx]);

        const lines = [
            `<h1>${missionData[MissionDataField.nameIdx]}</h1>`,
            `Released: <b>${formattedDate}</b>`,
            `Rating: <b>${missionData[MissionDataField.ratingAverageIdx]}</b> out of <b>${missionData[MissionDataField.ratingCountIdx]}</b> user ratings`,
            `Authors: <b>${missionData[MissionDataField.authorsIdx]}</b>`,
        ];

        if (this.dom.checkboxMissionThumbnails.checked) {
            const src = missionData[MissionDataField.thumbnailIdx];
            if (src) {
                lines.push(`<img src="${src}" width="480" height="270" />`);
            }
        }

        return lines.join('<br/>');
    }

    private syncOutputs() {
        this.dom.yBottomOutput.value = this.dom.yBottom.value;
        this.dom.yTopOutput.value = this.dom.yTop.value;
        this.dom.xLeftOutput.value = this.dom.xLeft.value;
        this.dom.xRightOutput.value = this.dom.xRight.value;
    }

    private getSymbolSize(params: MissionData): number {
        const base = this.dom.checkboxScaleByRatings.checked
            ? params[MissionDataField.ratingCountIdx]
            : 20;
        const scaled = base * this.radiusScale;
        return Math.min(this.maxSymbolSize, Math.max(this.minSymbolSize, scaled));
    }

    private applyYearRangeToInputs(range: YearRange) {
        if (!this.enableYearFilter) {
            return;
        }
        if (typeof range.min === 'number') {
            this.dom.xLeft.value = `${range.min}`;
        }
        if (typeof range.max === 'number') {
            this.dom.xRight.value = `${range.max}`;
        }
        this.syncOutputs();
    }

    private getUiYearRange(): YearRange | undefined {
        if (!this.enableYearFilter || !this.dom.checkboxLimitX.checked) {
            return undefined;
        }
        const min = Number(this.dom.xLeft.value);
        const max = Number(this.dom.xRight.value);
        return {
            min: Number.isNaN(min) ? undefined : min,
            max: Number.isNaN(max) ? undefined : max,
        };
    }

    private getActiveYearRange(): YearRange | undefined {
        return this.configYearRange ?? this.getUiYearRange();
    }

    private isMissionWithinYearRange(mission: Mission, range: YearRange): boolean {
        const year = mission.releaseDate?.getFullYear?.();
        if (typeof year !== 'number' || Number.isNaN(year)) {
            return false;
        }
        if (typeof range.min === 'number' && year < range.min) {
            return false;
        }
        if (typeof range.max === 'number' && year > range.max) {
            return false;
        }
        return true;
    }

    private setupChartInteractions() {
        this.chart.on('click', (params: echarts.ECElementEvent) => {
            if (params.componentSubType !== 'scatter') {
                return;
            }
            const missionData = params.data as MissionData;
            const idValue = missionData?.[MissionDataField.idIdx];
            const missionId = typeof idValue === 'number' ? idValue : Number(idValue);
            if (!missionId || Number.isNaN(missionId)) {
                return;
            }
            const url = `https://www.thiefguild.com/fanmissions/${missionId}/`;
            if (typeof window !== 'undefined') {
                window.open(url, '_blank', 'noopener');
            }
        });
    }

    private buildGameFilterOptions(): GameFilterOption[] {
        if (this.groupedGameOptions) {
            return [
                { id: 'all', label: 'All Games', predicate: () => true },
                {
                    id: 'tdp-tg',
                    label: 'Thief: TDP/G',
                    predicate: (mission) => mission.game === GAME.T1 || mission.game === GAME.TG,
                },
                {
                    id: 't2',
                    label: 'Thief II: TMA',
                    predicate: (mission) => mission.game === GAME.T2,
                },
                {
                    id: 'tdm',
                    label: 'The Dark Mod',
                    predicate: (mission) => mission.game === GAME.TDM,
                },
            ];
        }

        const entries: GameFilterOption[] = [
            { id: 'all', label: GAME.ALL.name, predicate: () => true },
        ];

        GAME.getValues()
            .filter((value) => value !== GAME.ALL)
            .forEach((value) => {
                entries.push({
                    id: value.name,
                    label: value.name,
                    predicate: (mission) => mission.game === value,
                });
            });

        return entries;
    }
}

function missionsToData(missions: Mission[]): MissionData[] {
    return missions.map((mission) => [
        mission.releaseDate,
        mission.ratingAverage,
        mission.ratingCount,
        mission.name,
        joinWithLineBreak(mission.authors, 4),
        mission.thumbnailUrl,
        joinWithLineBreak(mission.genres, 3),
        mission.id,
    ]);
}

function joinWithLineBreak(array: string[], elementsPerLine: number = 3): string {
    return array
        .reduce((acc: string[][], current, index) => {
            if (index % elementsPerLine === 0) {
                acc.push([]);
            }
            acc[acc.length - 1].push(current);
            return acc;
        }, [])
        .map((group) => group.join(', '))
        .join(',<br>');
}

function convertToMission(jsonData: MissionJson): Mission {
    return {
        name: jsonData.name,
        authors: jsonData.authors,
        releaseDate: new Date(jsonData.release_date),
        game: GAME.parseEnum(jsonData.game),
        id: jsonData.id,
        ratingAverage: jsonData.rating_average,
        ratingCount: jsonData.rating_count,
        thumbnailUrl: jsonData.thumbnail_url,
        genres: jsonData.genres,
        ratingDistribution: jsonData.rating_distribution,
    };
}

function resolveRoot(root: string | HTMLElement): HTMLElement {
    if (typeof root === 'string') {
        const element = document.querySelector<HTMLElement>(root);
        if (!element) {
            throw new Error(`Could not find element for selector "${root}"`);
        }
        return element;
    }
    return root;
}

function buildLayout(root: HTMLElement): ControlRefs {
    root.classList.add('tmv-root');
    root.innerHTML = LAYOUT_TEMPLATE;
    const select = queryRequired<HTMLSelectElement>(root, '[data-role="select-game"]');
    const chart = queryRequired<HTMLDivElement>(root, '[data-role="chart"]');
    const checkboxScale = queryRequired<HTMLInputElement>(root, '[data-role="scale-by-ratings"]');
    const checkboxThumbs = queryRequired<HTMLInputElement>(root, '[data-role="show-thumbnails"]');
    const checkboxLimitY = queryRequired<HTMLInputElement>(root, '[data-role="limit-y"]');
    const yBottom = queryRequired<HTMLInputElement>(root, '[data-role="y-bottom"]');
    const yTop = queryRequired<HTMLInputElement>(root, '[data-role="y-top"]');
    const yBottomOutput = queryRequired<HTMLOutputElement>(root, '[data-role="y-bottom-output"]');
    const yTopOutput = queryRequired<HTMLOutputElement>(root, '[data-role="y-top-output"]');
    const checkboxLimitX = queryRequired<HTMLInputElement>(root, '[data-role="limit-x"]');
    const xLeft = queryRequired<HTMLInputElement>(root, '[data-role="x-left"]');
    const xRight = queryRequired<HTMLInputElement>(root, '[data-role="x-right"]');
    const xLeftOutput = queryRequired<HTMLOutputElement>(root, '[data-role="x-left-output"]');
    const xRightOutput = queryRequired<HTMLOutputElement>(root, '[data-role="x-right-output"]');
    const yearFilterBlock = queryRequired<HTMLDivElement>(root, '[data-role="year-filter-block"]');
    const ratingFilterBlock = queryRequired<HTMLDivElement>(root, '[data-role="rating-filter-block"]');
    return {
        root,
        chart,
        selectGame: select,
        checkboxScaleByRatings: checkboxScale,
        checkboxMissionThumbnails: checkboxThumbs,
        checkboxLimitY,
        yBottom,
        yTop,
        yBottomOutput,
        yTopOutput,
        checkboxLimitX,
        xLeft,
        xRight,
        xLeftOutput,
        xRightOutput,
        yearFilterBlock,
        ratingFilterBlock,
    };
}

function queryRequired<T extends HTMLElement>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
        throw new Error(`Missing required element: ${selector}`);
    }
    return element;
}

function injectStyles() {
    if (document.getElementById(STYLE_ELEMENT_ID)) {
        return;
    }
    const style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.textContent = BASE_STYLES;
    document.head.appendChild(style);
}

function getYearBounds(missions: Mission[]): [number, number] {
    const fallbackYear = new Date().getFullYear();
    const years = missions
        .map((mission) => mission.releaseDate?.getFullYear?.() ?? fallbackYear)
        .filter((year) => !Number.isNaN(year));
    if (!years.length) {
        return [fallbackYear, fallbackYear];
    }
    return [Math.min(...years), Math.max(...years)];
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
});

function formatReleaseDate(value: MissionData[0]): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Unknown';
    }
    const formatted = DATE_FORMATTER.format(date);
    return formatted.replace(/^([A-Za-z]+)/, '$1.');
}

export function initThiefMissionsViz(options: InitOptions): ThiefVizHandle {
    if (!options?.data) {
        throw new Error('initThiefMissionsViz requires a `data` array.');
    }
    const viz = new ThiefMissionsViz(options);
    return viz.init();
}

declare global {
    interface Window {
        ThiefMissionsViz?: {
            init: typeof initThiefMissionsViz;
            convertMissionFromJson: typeof convertToMission;
        };
    }
}

if (typeof window !== 'undefined') {
    window.ThiefMissionsViz = {
        init: initThiefMissionsViz,
        convertMissionFromJson: convertToMission,
    };
}

export { convertToMission };
