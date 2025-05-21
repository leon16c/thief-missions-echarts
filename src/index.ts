import * as echarts from 'echarts';
import * as _ from 'lodash';

import jsonMissions from '../missions.json';

interface RatingDistribution {
    [key: number]: number;
}

type Mission = {
    name: string;
    authors: string[];
    releaseDate: Date;
    game: GAME;
    id: number;
    ratingAverage: number;
    ratingCount: number;
    thumbnailUrl: string;
    genres: string[];
    ratingDistribution: Record<string, number>;
};

type Filter = {
    game: GAME,
    dataType: DATA_TYPE
}

class MissionDataField {
    public static readonly releaseDateIdx = 0;
    public static readonly ratingAverageIdx = 1;
    public static readonly ratingCountIdx = 2;
    public static readonly nameIdx = 3;
    public static readonly authorsIdx = 4;
    public static readonly thumbnailIdx = 5;
    public static readonly genresIdx = 6;
}

type MissionData = [Date, number, number, string, string, string, string];

enum DATA_TYPE {
    Marker,
    Line,
    Both
}

class GAME {
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

    public static parseEnum(name: string): GAME {
        return GAME.AllValues[name];
    }

    public static getValues(): GAME[] {
        return Object.values(this.AllValues);
    }

    public toString(): string {
        return this.name;
    }

}

const selectGame = document.getElementById('selectGame') as HTMLSelectElement;
const selectDataType = document.getElementById('selectDataType') as HTMLSelectElement;
const checkboxesAuthors = document.getElementById('checkboxesAuthors') as HTMLDivElement;
const yTop = document.getElementById('ytop') as HTMLInputElement;
const yBottom = document.getElementById('ybottom') as HTMLInputElement;
const checkboxLimitY = document.getElementById('checkboxLimitY') as HTMLInputElement;


const xLeft = document.getElementById('xleft') as HTMLInputElement;
const xRight = document.getElementById('xright') as HTMLInputElement;
const checkboxLimitX = document.getElementById('checkboxLimitX') as HTMLInputElement;

const checkboxMissionThumbnails = document.getElementById('checkboxMissionThumbnails') as HTMLInputElement;
const checkboxScaleByRatings = document.getElementById('checkboxScaleByRatings') as HTMLInputElement;

function createmultiselectAuthors() {

    const allAuthors = _.uniq(_.flatten(_.map(missions, 'authors')));
    console.log(allAuthors);

    _.forEach(allAuthors, function (author) {
        const label = document.createElement('label') as HTMLLabelElement;
        const input = document.createElement('input') as HTMLInputElement;
        input.type = 'checkbox';
        input.name = 'options'
        label.textContent = author;
        input.value = author;
        label.appendChild(input);
        checkboxesAuthors.append(label);
        checkboxesAuthors.append(document.createElement('br'));
    })
}

function getSelectedOptions() {
    const checkboxes: NodeListOf<HTMLInputElement> = document.querySelectorAll('#checkboxesAuthors input[type="checkbox"]:checked');
    const selectedOptions: string[] = Array.from(checkboxes).map(cb => cb.value);
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
        .map(group => group.join(', '))
        .join(',<br>');
}

function createButtonSelectGame() {

    GAME.getValues().forEach((value: GAME) => {
        const optionElement = document.createElement('option');
        optionElement.value = value.name;
        optionElement.textContent = value.name;
        selectGame?.appendChild(optionElement);
    })

    selectGame?.addEventListener('change', (e) => {
        updateChart();
    });
}

function updateChart() {
    var filteredMissions: Mission[] = [...missions];

    const newFilter: Filter = {
        game: GAME.parseEnum(selectGame.value),
        dataType: DATA_TYPE.Marker
    }

    if (newFilter.game != GAME.ALL) {
        filteredMissions = _.filter(filteredMissions, mission => mission.game == newFilter.game);
    }

    const option: echarts.EChartsOption = {
        series: [
            {
                type: 'scatter',
                data: missionsToData(filteredMissions),
                symbolSize: function (params: MissionData) {
                    return checkboxScaleByRatings.checked ? params[MissionDataField.ratingCountIdx] : 20;
                }
            }
        ],
    };

    option.yAxis = {
        type: 'value',
        min: checkboxLimitY.checked ? yBottom.value : 1,
        max: checkboxLimitY.checked ? yTop.value : undefined
    }

    option.xAxis = {
        min: checkboxLimitX.checked ? new Date(`${xLeft.value}-01-01`) : undefined,
        max: checkboxLimitX.checked ? new Date(`${xRight.value}-12-31`) : undefined
    }
    
    myChart.setOption(option)
}

function convertToJsonMission(jsonData: any): Mission {
    const mission: Mission = {
        name: jsonData.name,
        authors: jsonData.authors,
        releaseDate: jsonData.release_date,
        game: GAME.parseEnum(jsonData.game),
        id: jsonData.id,
        ratingAverage: jsonData.rating_average,
        ratingCount: jsonData.rating_count,
        thumbnailUrl: jsonData.thumbnail_url,
        genres: jsonData.genres,
        ratingDistribution: jsonData.rating_distribution,
    };
    return mission;
}

const missions: Mission[] = _.filter(jsonMissions.map(convertToJsonMission), mission => mission.ratingAverage != -1);

function setupEventListeners() {
    checkboxScaleByRatings.addEventListener('change', (e) => {
        updateChart();
    })
    yBottom.addEventListener('input', (e) => {
        checkboxLimitY.checked = true;
        updateChart();
    })
    yTop.addEventListener('input', (e) => {
        checkboxLimitY.checked = true;
        updateChart();
    })
    checkboxLimitY.addEventListener('change', (e) => {
        updateChart();
    })
    xLeft.addEventListener('input', (e) => {
        checkboxLimitX.checked = true;
        updateChart();
    })
    xRight.addEventListener('input', (e) => {
        checkboxLimitX.checked = true;
        updateChart();
    })
    checkboxLimitX.addEventListener('change', (e) => {
        updateChart();
    })
}
function missionsToData(missions: Mission[]): MissionData[] {
    return _.map(missions, mission => [mission.releaseDate, mission.ratingAverage, mission.ratingCount, mission.name, joinWithLineBreak(mission.authors, 4), mission.thumbnailUrl, joinWithLineBreak(mission.genres, 3)]);
}

const myChart: echarts.ECharts = echarts.init(document.getElementById('chart'));

const initialMissionData: MissionData[] = missionsToData(missions);

var tooltipDisplay: string = ''

myChart.on('mouseover', function (params: echarts.ECElementEvent) {
    if (params.componentSubType == "scatter") {
        const hoveredMissionData = params?.data as MissionData;
        tooltipDisplay = `
        <h1>${hoveredMissionData[MissionDataField.nameIdx]}</h1></br>
        Released: <b>${hoveredMissionData[MissionDataField.releaseDateIdx]}</b></br>
        Rating: <b>${hoveredMissionData[MissionDataField.ratingAverageIdx]}</b> out of <b>${hoveredMissionData[MissionDataField.ratingCountIdx]}</b> user ratings</br>
        Author(s): <b>${hoveredMissionData[MissionDataField.authorsIdx]}</b></br>
        `;
        if (false) {
            tooltipDisplay += `Genres: ${hoveredMissionData[MissionDataField.genresIdx]}</br>`;
        }
        if (checkboxMissionThumbnails.checked) {
            tooltipDisplay += `<img src="${hoveredMissionData[MissionDataField.thumbnailIdx]}" width="640" height="360">`
        }
    }
});

myChart.on('mouseout', function (params: echarts.ECElementEvent) {
    tooltipDisplay = ''
});

const option: echarts.EChartsOption = {
    xAxis: { type: 'time' },
    yAxis: { type: 'value', min: 1 },
    series: [
        {
            type: 'scatter',
            data: initialMissionData,
            symbolSize: function (params: MissionData) {
                return params[MissionDataField.ratingCountIdx];
            }
        },
    ],
    tooltip: {
        trigger: 'item',
        formatter: (params) => {
            return tooltipDisplay;
        }
    }
};

option && myChart.setOption(option);

window.addEventListener('resize', () => {
    myChart.resize();
});

createButtonSelectGame();
//createmultiselectAuthors();
setupEventListeners();
