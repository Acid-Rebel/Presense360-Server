const turf = require('@turf/turf');

//const point = turf.point([yourLongitude, yourLatitude]);


 // true or false

function checkLocation(points)
{
    const point = turf.point(points);
    const polygon = turf.polygon([[
    [10.9019608488547, 76.89537292252518],
    [10.90205603623543, 76.89608452739897],
    [10.902125263403935, 76.8968776474025],
    [10.901480584789082, 76.89686002251398],
    [10.901404867410427, 76.89611977719636],
    [10.901454624546702, 76.89534868831093],
    [10.9019608488547, 76.89537292252518]
     // Close the polygon
]]);

const home = turf.polygon([[
    [11.28221496862027, 76.94699333902805],
    [11.282299140654006, 76.94711068567294],
    [11.282452359995853, 76.94699870344611],
    [11.282387915819102, 76.946883368458],
    [11.28221496862027, 76.94699333902805]
     // Close the polygon
]]);

const AB3 = turf.polygon([[
    [10.906595177090225, 76.89687039718245],
    [10.906727062259744, 76.89814310332501],
    [10.905989608855288, 76.89818601866943],
    [10.90605281921876, 76.89692001600928],
    [10.906595177090225, 76.89687039718245]
     // Close the polygon
]]);


    return turf.booleanPointInPolygon(point, polygon) || turf.booleanPointInPolygon(point, home) || turf.booleanPointInPolygon(point, AB3);
}

function checkDemo(points)
{
    if(points[0]==='37.4219983' && points[1]==='-122.084')
    {
        return true;
    }
    return false;
}

//console.log(checkLocation(['11.901715858383271,76.89612716256312']));
// console.log(Number('10.90224208421102'));
module.exports = {checkLocation,checkDemo};

//10.901715858383271, 76.89612716256312
