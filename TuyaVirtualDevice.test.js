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
        // Grid: 20 wide x 10 tall
        // 36 LEDs: 9 left + 18 top + 9 right
        // Placed at consecutive integer coordinates so they tile with no gaps.
        //
        // Left column: x=0, y=9 down to y=1  (9 LEDs)
        // Top row:     y=0, x=1 through x=18  (18 LEDs)
        // Right column: x=19, y=1 down to y=9  (9 LEDs)

        const positions = [];

        // Left column (9 LEDs): bottom to top at x=0
        for (let i = 0; i < 9; i++)
        {
            positions.push([0, 9 - i]);
        }

        // Top row (18 LEDs): left to right at y=0
        for (let i = 0; i < 18; i++)
        {
            positions.push([1 + i, 0]);
        }

        // Right column (9 LEDs): top to bottom at x=19
        for (let i = 0; i < 9; i++)
        {
            positions.push([19, 1 + i]);
        }

        return positions;
    }

    setupDevice(tuyaDevice)
    {
        this.tuyaLeds = DeviceList[tuyaDevice.deviceType].leds;
        this.ledCount = 36; // 36 segments (Light Pixel value from device)

        this.ledNames = this.getLedNames();
        this.ledPositions = this.getLedPositions();

        device.setName(tuyaDevice.getName());

        device.setSize([20, 10]); // grid sized to exactly fit the U-shape with no gaps
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
    
        for(let i = 0 ; i < this.ledPositions.length; i++){
            const ledPosition = this.ledPositions[i];
            const color = device.color(ledPosition[0], ledPosition[1]);
            RGBData.push(color);
        }
    
        return RGBData;
    }

    generateColorString(colors)
    {
        const numLeds = colors.length;

        if (numLeds === 1)
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

            // Each LED gets its own unique segment tag
            let colorString = '';
            for (let i = 1; i <= numLeds; i++)
            {
                colorString += this.getW32FromHex(i.toString(16), 1).toString(Hex);
            }

            let countHex = this.getW32FromHex(numLeds.toString(16), 2).toString(Hex);
            let spliceNumHex = this.getW32FromHex(numLeds.toString(16), 2).toString(Hex);
            let colorValue = countHex + colorArray.join('') + spliceNumHex + colorString;

            return colorValue;
        }
    }
}
