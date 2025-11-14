import Toggle from '../../../src/models/misc/Toggle';
import {
  getToggles, 
  getToggleByName,
  addToggle,
  updateToggle,
  deleteToggleByName 
} from '../../../src/services/admin/toggle.service';
import { IToggle } from '../../../src/types';

describe('getToggles function', () => {
  it('should fetch all existing toggles', async () => {
    const toggleData = await getToggles();
    expect(toggleData).toHaveLength(2);
  });

  it('should throw an error when an exception occurs', async () => {
    // Mock the Toggle model to throw an error
    jest.spyOn(Toggle, 'find').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });
    
    await expect(getToggles()).rejects.toThrow(
      'Mock database error'
    );
  });
});

describe('getToggleByName function', () => {
  const expectedToggle = {
    name: "testToggle",
    enabled: false,
    description: "Toggle for testing"
  }

  it('should fetch the corresponding toggle', async () => {
    const toggleData = await getToggleByName("testToggle");
    expect(toggleData).toEqual(expect.objectContaining(expectedToggle));
  });

  it('should return null if the corresponding toggle does not exist', async () => {
    const toggleData = await getToggleByName("testUnknownToggle");
    expect(toggleData).toBeNull();
  });

  it('should throw an error when an exception occurs', async () => {
    // Mock the Toggle model to throw an error
    jest.spyOn(Toggle, 'findOne').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });
    
    await expect(getToggleByName("testToggle")).rejects.toThrow(
      'Mock database error'
    );
  });
});

describe('addToggle function', () => {
  const existingToggle = {
    name: "testToggle",
    enabled: false,
    description: "Toggle for testing"
  } as IToggle;
  
  const newToggle = {
    name: "testToggle_2",
    enabled: true,
    description: "Toggle for testing_2"
  } as IToggle;

  it('should successfully add the new toggle', async () => {
    const toggleData = await addToggle(newToggle);
    expect(toggleData).toEqual(expect.objectContaining(newToggle));
  });

  it('should throw an error if a toggle with the same name already exists', async () => {
    await expect(addToggle(existingToggle)).rejects.toThrow(
      `A toggle with the identifier ${existingToggle.name} already exists.`
    );
  });

  it('should throw an error when an exception occurs', async () => {
    // Mock the Toggle model to throw an error
    jest.spyOn(Toggle, 'findOne').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });
    
    await expect(addToggle({
      name: "testToggle_3",
      enabled: true,
      description: "Toggle for testing_3"
    } as IToggle)).rejects.toThrow('Mock database error');
  });
});

describe('updateToggle function', () => {
  const updatedToggle = {
    name: "testToggle",
    enabled: true,
    description: "Toggle for testing updated"
  } as IToggle;

  it('should successfully update the toggle when it exists', async () => {
    const toggleData = await updateToggle("testToggle", true, "Toggle for testing updated");
    expect(toggleData).toEqual(expect.objectContaining(updatedToggle));
  });

  it('should successfully update the existing toggle when description is not provided', async () => {
    const expectedToggle = {
      name: "testToggle",
      enabled: false
    } as IToggle;

    const toggleData = await updateToggle("testToggle", false);
    expect(toggleData).toEqual(expect.objectContaining(expectedToggle));
  });

  it('should throw an error if the corresponding toggle does not exist', async () => {
    await expect(updateToggle("testUnknownToggle", false, "")).rejects.toThrow(
      `A toggle with the identifier testUnknownToggle does not exist.`
    );
  });

  it('should throw an error when an exception occurs', async () => {
    // Mock the Toggle model to throw an error
    jest.spyOn(Toggle, 'findOneAndUpdate').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });
    
    await expect(updateToggle("testToggle", false, "")).rejects.toThrow('Mock database error');
  });
});

describe('deleteToggleByName function', () => {
  const deletedToggle = {
    name: "testToggle_1",
    enabled: true,
    description: "Toggle for testing_1"
  }

  it('should delete the corresponding toggle', async () => {
    const toggleData = await deleteToggleByName("testToggle_1");
    expect(toggleData).toEqual(expect.objectContaining(deletedToggle));
  });

  it('should return null if the corresponding toggle does not exist', async () => {
    const toggleData = await deleteToggleByName("testUnknownToggle");
    expect(toggleData).toBeNull();
  });

  it('should throw an error when an exception occurs', async () => {
    // Mock the Toggle model to throw an error
    jest.spyOn(Toggle, 'findOneAndDelete').mockImplementationOnce(() => {
      throw new Error('Mock database error');
    });
    
    await expect(deleteToggleByName("testToggle_1")).rejects.toThrow(
      'Mock database error'
    );
  });
});