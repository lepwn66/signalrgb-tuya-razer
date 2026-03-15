import BaseClass from './Libs/BaseClass.test.js';
import DeviceList from './Data/DeviceList.test.js';
import TuyaDevice from './TuyaDevice.test.js';
import { Hex } from './Crypto/Hex.test.js';

export default class TuyaVirtualDevice extends BaseClass
{
    constructor(deviceData)
    {
        super();
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
            [0, 7], [0, 5], [0, 2],                    // left column, bottom to top
            [0, 0], [3, 0], [5, 0], [7, 0], [9, 0], [13, 0], // top row, left to right
            [13, 2], [13, 5], [13, 7]                  // right column, top to bottom
        ];
    }

    setupDevice(tuyaDevice)
    {
        this.tuyaLeds = DeviceList[tuyaDevice.deviceType].leds;
        this.ledCount = Math.min(this.tuyaLeds.length, 12);
        this.ledNames = this.getLedNames();
        this.ledPositions = this.getLedPositions();
        device.setName(tuyaDevice.getName());
        device.setSize([14, 8]);
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
            let colorString = this.generateColorString(RGBData);
            this.tuyaDevice.sendColors(colorString);
        }
    }

    getDeviceRGB()
    {
        const RGBData = [];
        for (let i = 0; i < this.ledPositions.length; i++)
        {
            const ledPosition = this.ledPositions[i];
            const color = device.color(ledPosition[0], ledPosition[1]);
            RGBData.push(color);
        }
        return RGBData;
    }

    generateColorString(colors)
    {
        if (colors.length === 1)
        {
            const [h1,s1,v1] = this.rgbToHsv(colors[0]);
            let color = this.getW32FromHex(h1.toString(16), 2).toString(Hex) +
                        this.getW32FromHex(parseInt(s1 / 10).toString(16), 1).toString(Hex) +
                        this.getW32FromHex(parseInt(v1 / 10).toString(16), 1).toString(Hex);
            return color + "00000100";
        }
        else
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
            for (let i = 1; i <= colors.length; i++)
            {
                if (i <= 4)       colorString += '01';
                else if (i <= 8)  colorString += '02';
                else if (i <= 12) colorString += '03';
            }

            let spliceNumHex = this.getW32FromHex(colors.length.toString(16), 2).toString(Hex);
            let countHex = this.getW32FromHex(colors.length.toString(16), 2).toString(Hex);
            let colorValue = '000c' + colorArray.join('') + spliceNumHex + colorString;
            console.log('colorValue: ' + colorValue);
            return colorValue;
        }
    }
}
