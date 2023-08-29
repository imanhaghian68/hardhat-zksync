import { HardhatNetworkAccountConfig, HardhatNetworkHDAccountsConfig, HardhatRuntimeEnvironment, HttpNetworkConfig, NetworkConfig } from 'hardhat/types';
import { ContractInfo, ContractNameDetails, MissingLibrary } from './types';
import { MorphTsBuilder } from './morph-ts-builder';
import fs from 'fs';
import { ZkSyncDeployPluginError } from './errors';
import { Wallet } from 'zksync-web3';

export function isHttpNetworkConfig(networkConfig: NetworkConfig): networkConfig is HttpNetworkConfig {
    return 'url' in networkConfig;
}

export function updateHardhatConfigFile(hre: HardhatRuntimeEnvironment, externalConfigObjectPath: string) {
    new MorphTsBuilder(externalConfigObjectPath ?? hre.config.paths.configFile)
        .intialStep({initialVariableType: "HardhatUserConfig"})
        .nextStep({propertyName: 'zksolc', isRequired: true})
        .nextStep({ propertyName: 'settings'})
        .replaceStep({ propertyName: 'libraries', replaceObject: hre.config.zksolc.settings.libraries})
        .save();
}

export function generateFullQuailfiedName(contractNameDetails: ContractNameDetails | MissingLibrary): string {
    return contractNameDetails.contractPath + ":" + contractNameDetails.contractName;
}

export async function fillLibrarySettings(hre: HardhatRuntimeEnvironment, libraries: ContractInfo[]) {
    libraries.forEach((library) => {
        let contractPath = library.contractNameDetails.contractPath;
        let contractName = library.contractNameDetails.contractName;

        if (!hre.config.zksolc.settings.libraries) {
            hre.config.zksolc.settings.libraries = {};
        }

        hre.config.zksolc.settings.libraries[contractPath] = {
            [contractName]: library.address
        };
    });
}

export function getLibraryInfos(hre: HardhatRuntimeEnvironment): Array<MissingLibrary> {
    const libraryPathFile = hre.config.zksolc.settings.missingLibrariesPath!;

    if (!fs.existsSync(libraryPathFile)) {
        throw new ZkSyncDeployPluginError('Missing librararies file not found');
    }

    return JSON.parse(fs.readFileSync(libraryPathFile, 'utf8'));
}

export function removeLibraryInfoFile(hre: HardhatRuntimeEnvironment) {
    const libraryPathFile = hre.config.zksolc.settings.missingLibrariesPath!;

    if (fs.existsSync(libraryPathFile)) {
        fs.rmSync(libraryPathFile);
    }
}

export async function compileContracts(hre: HardhatRuntimeEnvironment, contracts: string[]) {
    hre.config.zksolc.settings.contractsToCompile = contracts;

    await hre.run('compile', { force: true });
}

export function getWallet(hre: HardhatRuntimeEnvironment, accountNumber: number) {
    const accounts = hre.network.config.accounts;

    if(!accounts) {
        throw new ZkSyncDeployPluginError('Accounts for selected newtwork are not specified');
    }

    if(isHardhatNetworkAccountsConfigStrings(accounts)) {
        const accountPrivateKey = (accounts as string[])[accountNumber];

        if(!accountPrivateKey) {
            throw new ZkSyncDeployPluginError('Account private key with specified index is not found');
        }

        return new Wallet(accountPrivateKey);
    }

    if(isHardhatNetworkHDAccountsConfig(accounts)) {
        const account = (accounts as HardhatNetworkHDAccountsConfig);
        return Wallet.fromMnemonic(account.mnemonic, account.path);
    }

    const account = (accounts as HardhatNetworkAccountConfig[])[accountNumber];

    if(!account) {
        throw new ZkSyncDeployPluginError('Account with specified index is not found');
    }

    return new Wallet(account.privateKey);
}

function isHardhatNetworkHDAccountsConfig(object: any): object is HardhatNetworkHDAccountsConfig {
    return 'mnemonic' in object;
}

function isHardhatNetworkAccountsConfigStrings(object: any): object is string[] {
    return typeof object[0] === 'string';
}