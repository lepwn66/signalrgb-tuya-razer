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
        // High-resolution grid: 20 wide x 12 tall
        // LEDs placed at precise points along the U-shape perimeter
        // so each LED samples a small canvas area instead of a huge block.
        //
        // Layout (3 left + 6 top + 3 right = 12 LEDs):
        //
        //   L3  T1  T2  T3  T4  T5  T6  R1
        //   L2                          R2
        //   L1                          R3
        //
        const W = 19; // max x index (grid is 20 wide: 0-19)
        const H = 11; // max y index (grid is 12 tall: 0-11)

        return [
            // Left column (3 LEDs): bottom to top at x=0
            [0, H],                         // L1 - bottom-left
            [0, Math.round(H / 2)],         // L2 - mid-left
            [0, 0],                         // L3 - top-left corner

            // Top row (6 LEDs): left to right at y=0
            [Math.round(W * 1/7), 0],       // T1
            [Math.round(W * 2/7), 0],       // T2
            [Math.round(W * 3/7), 0],       // T3
            [Math.round(W * 4/7), 0],       // T4
            [Math.round(W * 5/7), 0],       // T5
            [Math.round(W * 6/7), 0],       // T6

            // Right column (3 LEDs): top to bottom at x=W
            [W, 0],                         // R1 - top-right corner
            [W, Math.round(H / 2)],         // R2 - mid-right
            [W, H],                         // R3 - bottom-right
        ];
    }

    setupDevice(tuyaDevice)
    {
        this.tuyaLeds = DeviceList[tuyaDevice.deviceType].leds;
        this.ledCount = this.tuyaLeds.length; // use actual LED count (12), no artificial cap

        this.ledNames = this.getLedNames();
        this.ledPositions = this.getLedPositions();

        device.setName(tuyaDevice.getName());

        device.setSize([20, 12]); // high-resolution grid for precise color sampling
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

            // Use actual color count for the count prefix
            let countHex = this.getW32FromHex(colors.length.toString(16), 2).toString(Hex);
            let spliceNumHex = this.getW32FromHex(spliceLength.toString(16), 2).toString(Hex);
            let colorValue = countHex + colorArray.join('') + spliceNumHex + colorString;

            return colorValue;
        }
    }
}
