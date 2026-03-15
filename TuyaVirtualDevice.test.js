import BaseClass from './Libs/BaseClass.test.js';
import DeviceList from './Data/DeviceList.test.js';
import TuyaDevice from './TuyaDevice.test.js';
import { Hex } from './Crypto/Hex.test.js';

export default class TuyaVirtualDevice extends BaseClass
{
    constructor(deviceData)
    {
        super();
        // Initialize tuya device from saved data
        this.tuyaDevice = new TuyaDevice(deviceData, null);
        this.frameDelay = 50;
        this.lastRender = 0;

        this.setupDevice(this.tuyaDevice);
    }
    
    getLedNames()
    {
        let ledNames = [];
        for (let i = 1; i <= this.ledCount; i++)
        {
            ledNames.push(`Led ${i}`);
        }
        return ledNames;
    }

    getLedPositions()
    {
        return [
            [0, 3], [0, 2], [0, 1],                        // left column (3): bottom to top
            [0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], // top row (6): left to right
            [5, 1], [5, 2], [5, 3]                          // right column (3): top to bottom
        ];
    }

    setupDevice(tuyaDevice)
    {
        this.tuyaLeds = DeviceList[tuyaDevice.deviceType].leds;
        this.ledCount = this.tuyaLeds.length; // use actual LED count (12), no artificial cap

        this.ledNames = this.getLedNames();
        this.ledPositions = this.getLedPositions();

        device.setName(tuyaDevice.getName());

        device.setSize([6, 4]); // U-shape bounding box: 6 wide, 4 tall
        device.setControllableLeds(this.ledNames, this.ledPositions);
    }

    render(lightingMode, forcedColor, now)
    {
        if (now - this.lastRender > this.frameDelay)
        {
            this.lastRender = now;
            let RGBData = [];
            switch(lightingMode)
            {
                case "Canvas":
                    RGBData = this.getDeviceRGB();
                    break;
                case "Forced":
                    for (let i = 0; i < this.ledCount; i++)
                    {
                        RGBData.push(this.hexToRGB(forcedColor));
                    }
                    break;
            }

            // Maybe this should be in the TuyaDevice
            let colorString = this.generateColorString(RGBData);

            // Maybe this should be done by a global controller
            this.tuyaDevice.sendColors(colorString);
        }
    }

    getDeviceRGB()
    {
        const RGBData = [];
    
        for(let i = 0 ; i < this.ledPositions.length; i++){
            const ledPosition = this.ledPositions[i];
            const color = device.color(ledPosition[0], ledPosition[1]);
            RGBData.push(color);
        }
    
        return RGBData;
    }

    generateColorString(colors)
    {
        let spliceLength = this.tuyaLeds.length;
        if (colors.length == 1) spliceLength = 1;

        if (spliceLength === 1)
        {
            const [h1,s1,v1] = this.rgbToHsv(colors[0]);
            let color = this.getW32FromHex(h1.toString(16), 2).toString(Hex) +
                        this.getW32FromHex(parseInt(s1 / 10).toString(16), 1).toString(Hex) +
                        this.getW32FromHex(parseInt(v1 / 10).toString(16), 1).toString(Hex);

            return color + "00000100";
        } else
        {
            let colorArray = [];

            for (let color of colors)
            {
                const [h,s,v] = this.rgbToHsv(color);
                colorArray.push(
                    this.getW32FromHex(h.toString(16), 2).toString(Hex) +
                    this.getW32FromHex(s.toString(16), 2).toString(Hex) +
                    this.getW32FromHex(v.toString(16), 2).toString(Hex)
                );
            }

            let colorString = '';

            for(let i = 1; i <= this.tuyaLeds.length; i++)
            {
                if (i <= 4) {
                    colorString += '01';
                } else if (i <= 8) {
                    colorString += '02';
                } else if (i <= 12) {
                    colorString += '03';
                }
            }

            // Use actual color count for the count prefix, not hardcoded '0004'
            let countHex = this.getW32FromHex(colors.length.toString(16), 2).toString(Hex);
            let spliceNumHex = this.getW32FromHex(spliceLength.toString(16), 2).toString(Hex);
            let colorValue = countHex + colorArray.join('') + spliceNumHex + colorString;

            return colorValue;
        }
    }
}
